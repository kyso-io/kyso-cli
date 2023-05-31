/* eslint-disable complexity */
/* eslint-disable no-await-in-loop */
import type { GitMetadata, File as KysoFile, NormalizedResponseDTO, ReportDTO, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { CheckPermissionDto, KysoConfigFile, KysoSettingsEnum, ReportPermissionsEnum, ReportType } from '@kyso-io/kyso-model';
import { Api, createKysoReportAction, setOrganizationAuthAction, setTeamAuthAction, store, updateKysoReportAction } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import AdmZip from 'adm-zip';
import type { AxiosResponse } from 'axios';
import axios from 'axios';
import FormData from 'form-data';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import hostedGitInfo from 'hosted-git-info';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { homedir } from 'os';
import { basename, extname, isAbsolute, join } from 'path';
import type { BranchSummary, SimpleGit } from 'simple-git';
import { CleanOptions, simpleGit } from 'simple-git';
import { v4 as uuidv4 } from 'uuid';
import { Helper } from '../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login';
import type { ErrorResponse } from '../types/error-response';
import type { KysoCredentials } from '../types/kyso-credentials';
import { KysoCommand } from './kyso-command';

export default class Push extends KysoCommand {
  static description = 'Upload local repository to Kyso';

  static examples = [`$ kyso push --path ./my-report`];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push. Default is "."',
      required: false,
      default: '.',
    }),
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false,
    }),
    message: Flags.string({
      char: 'm',
      description: 'Push message',
      required: false,
      default: undefined,
    }),
  };

  static args = [];

  private getEmbeddedReportHTML(title: string, url: string): string {
    return `
      <!DOCTYPE html>
      <html lang="EN" xml:lang="en">
        <head>
          <meta charset="utf-8">
          <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto+Mono:400,500&amp;amp;display=swap">
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <title>${title}</title>
          <script type="text/javascript"></script>
        </head>
        <body>
          <iframe title="${title}" id="theframe" style="width: 100%; height: 950px; border: none;" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" src="${url}"></iframe>
          <script type="text/javascript">
            function onInitIFrame() {
              try {
                const myIframe = document.getElementById('theframe');
                setTimeout(() => {
                    setHeight(myIframe.contentWindow.document.body.scrollHeight + 20px");
                }, 1500);
              } catch (ex) {
              }
            }
          </script>
        </body>
      </html>
    `;
  }

  private async getGitMetadata(localPath: string): Promise<GitMetadata> {
    try {
      const options = {
        baseDir: localPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      };
      simpleGit().clean(CleanOptions.FORCE);
      const git: SimpleGit = simpleGit(options);
      const logResult = await git.log();
      let repository: string | null = null;
      try {
        const remoteUrl: string = await git.listRemote(['--get-url']);
        const hostedGitInfoUrl = hostedGitInfo.fromUrl(remoteUrl);
        repository = hostedGitInfoUrl ? Helper.sanitizeUrlBasicAuthentication(hostedGitInfoUrl.https().replace('git+', '')) : Helper.sanitizeUrlBasicAuthentication(remoteUrl);
      } catch (e) {
        // Do nothing
      }
      const branchSummary: BranchSummary = await git.branchLocal();
      return {
        repository,
        branch: branchSummary.current,
        latest_commit: logResult.all.slice(0, 10),
      };
    } catch (e) {
      return null;
    }
  }

  private async uploadReportAux(
    reportFolder: string,
    basePath: string,
    validFiles: { path: string; sha: string }[],
    pushMessage: string,
    metaOrganization?: string,
    metaChannel?: string,
  ): Promise<void> {
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api(kysoCredentials.token);
    api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials.token);

    const { kysoConfigFile, valid, message, kysoConfigPath } = Helper.findKysoConfigFile(
      validFiles.map((f: { path: string; sha: string }) => f.path),
      basePath,
    );
    if (!valid) {
      this.log(`\nError: Could not push report of '${reportFolder}' folder using Kyso config file: ${message}\n`);
      return;
    }

    // SLUG everything. Is idempotent, makes no effect if already slugified. But if is the display name
    // because the user entered it by mistake, we can avoid an error slugifing by ourselves
    if (kysoConfigFile.channel) {
      kysoConfigFile.channel = Helper.slug(kysoConfigFile.channel);
    }

    if (kysoConfigFile.team) {
      kysoConfigFile.team = Helper.slug(kysoConfigFile.team);
    }

    // Channel not set. If there are metas, apply it
    if (!kysoConfigFile.channel && !kysoConfigFile.team) {
      if (metaChannel) {
        console.log('Applying meta channel');
        kysoConfigFile.team = metaChannel;
        kysoConfigFile.channel = metaChannel;
      } else {
        // Not set and no metas ---> Error
        kysoConfigFile.team = null;
        kysoConfigFile.channel = null;
      }
    }

    if (kysoConfigFile.organization) {
      kysoConfigFile.organization = Helper.slug(kysoConfigFile.organization);
    }

    // Organization not set. If there are metas, apply it
    if (!kysoConfigFile.organization) {
      if (metaOrganization) {
        console.log('Applying meta organization');
        kysoConfigFile.organization = metaOrganization;
      } else {
        // Not set and no metas ---> Error
        kysoConfigFile.organization = null;
      }
    }

    const { payload }: any = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    const indexOrganization: number = tokenPermissions.organizations.findIndex(
      (resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === kysoConfigFile.organization,
    );
    if (indexOrganization === -1 && !Helper.isGlobalAdmin(tokenPermissions)) {
      this.log(`\nYou don't have permissions to create reports in the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`);
      return;
    }
    let teamId: string | null = null;
    try {
      const checkPermissionDto: CheckPermissionDto = new CheckPermissionDto(kysoConfigFile.organization, kysoConfigFile.team, ReportPermissionsEnum.CREATE);
      const resultCheckPermission: NormalizedResponseDTO<boolean> = await api.checkPermission(checkPermissionDto);
      if (resultCheckPermission.data) {
        const indexTeam: number = tokenPermissions.teams.findIndex(
          (resourcePermissionTeam: ResourcePermissions) =>
            resourcePermissionTeam.name === kysoConfigFile.team && resourcePermissionTeam.organization_id === tokenPermissions.organizations[indexOrganization].id,
        );
        if (indexTeam > -1) {
          teamId = tokenPermissions.teams[indexTeam].id;
        } else {
          this.log(
            `\You don't have permission to create reports in the '${kysoConfigFile.team}' channel of the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`,
          );
          return;
        }
      } else {
        this.log(
          `\You don't have permission to create reports in the '${kysoConfigFile.team}' channel of the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`,
        );
        return;
      }
    } catch (error: any) {
      this.log(`\nError: ${error.response.data.message}\n`);
      return;
    }

    if (kysoConfigFile?.organization && kysoConfigFile.organization.length > 0) {
      store.dispatch(setOrganizationAuthAction(kysoConfigFile.organization));
    }
    if (kysoConfigFile?.team && kysoConfigFile.team.length > 0) {
      store.dispatch(setTeamAuthAction(kysoConfigFile.team));
    }

    delete kysoConfigFile.id;
    delete kysoConfigFile.links;
    delete kysoConfigFile.created_at;
    delete kysoConfigFile.updated_at;
    delete kysoConfigFile.team;

    let newFiles: string[] = [];
    const unmodifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    let reportDto: ReportDTO | null = null;
    let version = 1;
    try {
      const reportSlug: string = Helper.slug(kysoConfigFile.title);
      const resultReport: NormalizedResponseDTO<ReportDTO> = await api.getReportByTeamIdAndSlug(teamId, reportSlug);
      reportDto = resultReport.data;
      version = reportDto.last_version;
      const resultFiles: NormalizedResponseDTO<KysoFile[]> = await api.getReportFiles(reportDto.id, reportDto.last_version);
      const reportFiles: KysoFile[] = resultFiles.data;
      validFiles.forEach((validFile: { path: string; sha: string }) => {
        const indexFile: number = reportFiles.findIndex((reportFile: KysoFile) => {
          let validFilePathWithoutBasePath: string = basePath === '.' ? validFile.path : validFile.path.replace(basePath, '');
          if (validFilePathWithoutBasePath.startsWith('/')) {
            validFilePathWithoutBasePath = validFilePathWithoutBasePath.slice(1);
          }
          return reportFile.sha === validFile.sha && reportFile.name === validFilePathWithoutBasePath;
        });
        if (indexFile === -1) {
          newFiles.push(validFile.path);
        } else {
          unmodifiedFiles.push(reportFiles[indexFile].id);
        }
      });
      if (newFiles.length === 0) {
        this.log(`No new or modified files to upload in report '${kysoConfigFile.title}'`);
        return;
      }
      reportFiles.forEach((reportFile: KysoFile) => {
        const indexFile: number = validFiles.findIndex((validFile: { path: string; sha: string }) => reportFile.sha === validFile.sha);
        if (indexFile === -1) {
          deletedFiles.push(reportFile.id);
        }
      });
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      if (errorResponse.statusCode === 404) {
        newFiles = validFiles.map((file: { path: string; sha: string }) => file.path);
      }
    }

    // Check if report has defined main file
    if (kysoConfigFile.main && validFiles.length > 0) {
      // Remove last traling / if exists
      const sanitizeBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
      const indexMainFile: number = validFiles.findIndex((x) => x.path.endsWith(`${sanitizeBasePath}/${kysoConfigFile.main}`));

      if (indexMainFile === -1) {
        this.log(`\nError: Main file '${kysoConfigFile.main}' defined in the '${reportFolder}' folder does not exist.\n`);
        return;
      }
    }

    let updateKysoConfigFile = false;
    if (!kysoConfigFile.authors || kysoConfigFile.authors.length === 0) {
      kysoConfigFile.authors = [payload.email];
      updateKysoConfigFile = true;
    }
    if (kysoConfigFile?.type === ReportType.Embedded) {
      kysoConfigFile.main = 'index.html';
      writeFileSync(`${basePath}/index.html`, this.getEmbeddedReportHTML(kysoConfigFile.title, kysoConfigFile.url));
      updateKysoConfigFile = true;
    }
    if (updateKysoConfigFile) {
      if (kysoConfigPath.endsWith('.json')) {
        writeFileSync(kysoConfigPath, JSON.stringify(kysoConfigFile, null, 2));
      } else {
        writeFileSync(kysoConfigPath, jsYaml.dump(kysoConfigFile));
      }
    }

    const resultKysoSettings: NormalizedResponseDTO<string> = await api.getSettingValue(KysoSettingsEnum.MAX_FILE_SIZE);
    let existsMethod = true;
    // Check the put endpoint is available in the api
    try {
      api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials.token, kysoConfigFile.organization, kysoConfigFile.team || kysoConfigFile.channel);
      await api.getHttpClient().put(`/reports/kyso/XXXX`);
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      if (errorResponse.statusCode === 404) {
        existsMethod = false;
      }
    }
    this.log(`Uploading report '${reportFolder}'`);
    let result: any | null;
    if (existsMethod && reportDto) {
      result = await store.dispatch(
        updateKysoReportAction({
          filePaths: newFiles,
          basePath,
          maxFileSizeStr: resultKysoSettings.data || '500mb',
          id: reportDto.id,
          unmodifiedFiles,
          deletedFiles,
          version,
          message: pushMessage,
          git_metadata: await this.getGitMetadata(basePath),
        }),
      );
    } else {
      result = await store.dispatch(
        createKysoReportAction({
          filePaths: validFiles.map((file: { path: string; sha: string }) => file.path),
          basePath,
          maxFileSizeStr: resultKysoSettings.data || '500mb',
          message: pushMessage,
          git_metadata: await this.getGitMetadata(basePath),
        }),
      );
    }
    const { error } = store.getState();
    if (error.text) {
      this.error(`\n😞 ${error.text}`);
    }
    if (result?.payload?.isAxiosError || result.payload === null) {
      this.error(`\n😞 Something went wrong pushing the report in '${reportFolder}' folder. Please check the console log.`);
    } else {
      const kysoCredentials = JSON.parse(readFileSync(KysoCommand.tokenFilePath, 'utf8').toString());
      const normalizedResponse: NormalizedResponseDTO<ReportDTO | ReportDTO[]> = result.payload;
      if (Array.isArray(normalizedResponse.data)) {
        for (const reportDto of normalizedResponse.data) {
          const reportUrl = `${kysoCredentials.kysoInstallUrl}/${reportDto.organization_sluglified_name}/${reportDto.team_sluglified_name}/${reportDto.name}`;
          this.log(`🎉🎉🎉 Report ${reportDto.title} was uploaded to: ${reportUrl} 🎉🎉🎉\n`);
        }
      } else {
        const reportDto: ReportDTO = normalizedResponse.data;
        const reportUrl = `${kysoCredentials.kysoInstallUrl}/${reportDto.organization_sluglified_name}/${reportDto.team_sluglified_name}/${reportDto.name}`;
        this.log(`🎉🎉🎉 Report ${reportDto.title} was uploaded to: ${reportUrl} 🎉🎉🎉\n`);
      }
    }
  }

  private async uploadReport(validFiles: { path: string; sha: string }[], basePath: string, pushMessage: string): Promise<void> {
    if (validFiles.length === 0) {
      return;
    }
    // Check if report is a multiple report
    let mainKysoConfigFile: KysoConfigFile | null = null;

    const data: { kysoConfigFile: KysoConfigFile; valid: boolean; message: string } = Helper.findKysoConfigFile(
      validFiles.map((file: { path: string; sha: string }) => file.path),
      basePath,
    );
    if (!data.valid) {
      this.log(`Error in Kyso config file: ${data.message}`);
      return;
    }
    mainKysoConfigFile = data.kysoConfigFile;

    if (mainKysoConfigFile?.reports) {
      this.log(`\n${mainKysoConfigFile.reports.length} ${mainKysoConfigFile.reports.length > 1 ? 'reports' : 'report'} found\n`);

      // Retrieve meta organization and meta channel (defaults)
      const metaOrganization = mainKysoConfigFile.organization;
      const metaChannel = mainKysoConfigFile.channel ? mainKysoConfigFile.channel : mainKysoConfigFile.team;

      for (const reportFolder of mainKysoConfigFile.reports) {
        // Check if folder exists
        const reportPath: string = join(basePath, reportFolder);
        if (!existsSync(reportPath)) {
          this.error(`Report '${reportFolder}' folder does not exist.`);
        }
        const validFiles: { path: string; sha: string }[] = Helper.getValidFiles(reportPath);
        const { valid, message } = Helper.findKysoConfigFile(
          validFiles.map((file: { path: string; sha: string }) => file.path),
          basePath,
        );
        if (!valid) {
          this.error(`Folder '${reportFolder}' does not have a valid Kyso config file: ${message}`);
        }
        await this.uploadReportAux(reportFolder, reportPath, validFiles, pushMessage, metaOrganization, metaChannel);
      }
    } else {
      const parts: string[] = basePath.split('/');
      const reportFolder: string = parts[parts.length - 1];
      await this.uploadReportAux(reportFolder, basePath, validFiles, pushMessage);
    }
  }

  private getHeadersFromMarkdownFile(filePath: string): { [key: string]: string } {
    const fileContent = readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('---')) {
        if (startIndex === -1) {
          startIndex = i;
        } else {
          endIndex = i;
          break;
        }
      }
    }
    if (startIndex === -1 || endIndex === -1) {
      return null;
    }
    try {
      const headersStr = lines.slice(startIndex + 1, endIndex);
      return jsYaml.load(headersStr.join('\n')) as { [key: string]: string };
    } catch (e) {
      return null;
    }
  }

  private getHeadersFromJupyterFile(filePath: string): { [key: string]: string } {
    try {
      const fileContentStr = readFileSync(filePath, 'utf8');
      if (!fileContentStr) {
        return null;
      }
      const fileContent = JSON.parse(fileContentStr);
      if (!fileContent.cells || !Array.isArray(fileContent.cells) || fileContent.cells.length === 0) {
        return null;
      }
      const firstCell = fileContent.cells[0];
      if (!firstCell.source || !Array.isArray(firstCell.source) || firstCell.source.length === 0) {
        return null;
      }
      const firstLine = firstCell.source[0];
      if (!firstLine.startsWith('---')) {
        return null;
      }
      const lines = firstCell.source;
      let startIndex = -1;
      let endIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('---')) {
          if (startIndex === -1) {
            startIndex = i;
          } else {
            endIndex = i;
            break;
          }
        }
      }
      if (startIndex === -1 || endIndex === -1) {
        return null;
      }
      const headersStr = lines.slice(startIndex + 1, endIndex);
      return jsYaml.load(headersStr.join('\n')) as { [key: string]: string };
    } catch (e) {
      return null;
    }
  }

  private getFiles(folderPath: string): { singleFileReports: { headers: { [key: string]: string }; filePath: string; sha: string }[]; reportFiles: { path: string; sha: string }[] } {
    const validFiles: { path: string; sha: string }[] = Helper.getValidFiles(folderPath);
    const singleFileReports: { headers: { [key: string]: string }; filePath: string; sha: string }[] = [];
    const reportFiles: { path: string; sha: string }[] = [];
    for (const validFile of validFiles) {
      const extension = extname(validFile.path);
      if (extension === '.md') {
        const headers: { [key: string]: string } = this.getHeadersFromMarkdownFile(validFile.path);
        if (headers) {
          singleFileReports.push({ headers, filePath: validFile.path, sha: validFile.sha });
        } else {
          reportFiles.push(validFile);
        }
      } else if (extension === '.ipynb') {
        const headers: { [key: string]: string } = this.getHeadersFromJupyterFile(validFile.path);
        if (headers) {
          singleFileReports.push({ headers, filePath: validFile.path, sha: validFile.sha });
        } else {
          reportFiles.push(validFile);
        }
      } else {
        reportFiles.push(validFile);
      }
    }
    return {
      singleFileReports,
      reportFiles,
    };
  }

  private async uploadSimpleFile(basePath: string, reportSingleFile: { headers: { [key: string]: string }; filePath: string; sha: string }, pushMessage: string): Promise<ReportDTO> {
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api(kysoCredentials.token);
    api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials.token);

    const fileName: string = basename(reportSingleFile.filePath);
    const kysoConfigFile: KysoConfigFile = { ...reportSingleFile.headers } as any;
    kysoConfigFile.main = fileName;
    const { valid, message } = KysoConfigFile.isValid(kysoConfigFile);
    if (!valid) {
      this.log(`\nError: Could not push report file of '${fileName}': ${message}\n`);
      return null;
    }

    if (kysoConfigFile.channel) {
      kysoConfigFile.channel = Helper.slug(kysoConfigFile.channel);
      kysoConfigFile.team = kysoConfigFile.channel;
    } else if (kysoConfigFile.team) {
      kysoConfigFile.team = Helper.slug(kysoConfigFile.team);
      kysoConfigFile.channel = kysoConfigFile.team;
    }
    if (kysoConfigFile.organization) {
      kysoConfigFile.organization = Helper.slug(kysoConfigFile.organization);
    }

    const { payload }: any = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    const indexOrganization: number = tokenPermissions.organizations.findIndex(
      (resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === kysoConfigFile.organization,
    );
    if (indexOrganization === -1 && !Helper.isGlobalAdmin(tokenPermissions)) {
      this.log(`\You don't have permissions to create reports in the '${kysoConfigFile.organization}' organization defined in the '${reportSingleFile.filePath}' file.\n`);
      return;
    }
    let teamId: string | null = null;
    try {
      const checkPermissionDto: CheckPermissionDto = new CheckPermissionDto(kysoConfigFile.organization, kysoConfigFile.team, ReportPermissionsEnum.CREATE);
      const resultCheckPermission: NormalizedResponseDTO<boolean> = await api.checkPermission(checkPermissionDto);
      if (resultCheckPermission.data) {
        const indexTeam: number = tokenPermissions.teams.findIndex(
          (resourcePermissionTeam: ResourcePermissions) =>
            resourcePermissionTeam.name === kysoConfigFile.team && resourcePermissionTeam.organization_id === tokenPermissions.organizations[indexOrganization].id,
        );
        if (indexTeam > -1) {
          teamId = tokenPermissions.teams[indexTeam].id;
        } else {
          this.log(
            `\You don't have permission to create reports in the '${kysoConfigFile.team}' channel of the '${kysoConfigFile.organization}' organization defined in the '${reportSingleFile.filePath}' file.\n`,
          );
          return;
        }
      } else {
        this.log(
          `\You don't have permission to create reports in the '${kysoConfigFile.team}' channel of the '${kysoConfigFile.organization}' organization defined in the '${reportSingleFile.filePath}' file.\n`,
        );
        return;
      }
    } catch (error: any) {
      this.log(`\nError: ${error.response.data.message}\n`);
      return;
    }
    if (kysoConfigFile?.organization && kysoConfigFile.organization.length > 0) {
      store.dispatch(setOrganizationAuthAction(kysoConfigFile.organization));
    }
    if (kysoConfigFile?.team && kysoConfigFile.team.length > 0) {
      store.dispatch(setTeamAuthAction(kysoConfigFile.team));
    }

    delete kysoConfigFile.id;
    delete kysoConfigFile.links;
    delete kysoConfigFile.created_at;
    delete kysoConfigFile.updated_at;
    delete kysoConfigFile.team;
    if (!kysoConfigFile.authors || kysoConfigFile.authors.length === 0) {
      kysoConfigFile.authors = [payload.email];
    }

    try {
      const reportSlug: string = Helper.slug(kysoConfigFile.title);
      const responseReportDto: NormalizedResponseDTO<ReportDTO> = await api.getReportByTeamIdAndSlug(teamId, reportSlug);
      const reportDto = responseReportDto.data;
      const responseReportFiles: NormalizedResponseDTO<KysoFile[]> = await api.getReportFiles(reportDto.id, reportDto.last_version);
      const reportFiles: KysoFile[] = responseReportFiles.data;
      const reportFile: KysoFile | undefined = reportFiles.find((reportFile: KysoFile) => reportFile.name === fileName);
      if (!reportFile) {
        this.log(`\nError: Could not find the file '${fileName}' in the report '${kysoConfigFile.title}'\n`);
        return reportDto;
      }
      if (reportFile.sha === reportSingleFile.sha) {
        this.log(`\nError: The file '${fileName}' has not changed since the last push\n`);
        return reportDto;
      }
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      if (errorResponse.statusCode === 404) {
        // Report does not exist
      }
    }

    const zip: AdmZip = new AdmZip();
    zip.addFile(fileName, readFileSync(reportSingleFile.filePath));
    zip.addFile('kyso.yaml', Buffer.from(jsYaml.dump(kysoConfigFile)));
    const zipFileName = `${uuidv4()}.zip`;
    let outputFilePath = join(homedir(), '.kyso', 'tmp');
    if (!existsSync(outputFilePath)) {
      mkdirSync(outputFilePath, {
        recursive: true,
      });
    }
    outputFilePath = join(outputFilePath, zipFileName);
    zip.writeZip(outputFilePath);

    const resultKysoSettings: NormalizedResponseDTO<string> = await api.getSettingValue(KysoSettingsEnum.MAX_FILE_SIZE);

    const { size } = statSync(outputFilePath);
    const maxFileSize = Helper.parseFileSizeStr(resultKysoSettings.data || '500mb');
    if (size > maxFileSize) {
      this.log(`\nError: You exceeded the maximum upload size permitted (${payload.maxFileSizeStr})`);
      return null;
    }

    const formData = new FormData();
    formData.append('ignoreKysoConfigFile', 'true');
    formData.append('file', createReadStream(outputFilePath), {
      filename: zipFileName,
      knownLength: size,
    });
    if (pushMessage) {
      formData.append('message', pushMessage);
    }
    const gitMetadata: GitMetadata = await this.getGitMetadata(basePath);
    if (gitMetadata) {
      formData.append('git_metadata', JSON.stringify(payload.git_metadata));
    }

    this.log(`Uploading report '${reportSingleFile.filePath}'`);
    let reportDto: ReportDTO | null = null;
    try {
      const url = `${kysoCredentials.kysoInstallUrl}/api/v1/reports/kyso`;
      const response: AxiosResponse<NormalizedResponseDTO<ReportDTO>> = await axios.post(url, formData, {
        headers: {
          ...formData.getHeaders(),
          'content-length': formData.getLengthSync().toString(),
          Authorization: `Bearer ${kysoCredentials.token}`,
          'x-kyso-organization': kysoConfigFile.organization,
          'x-kyso-team': kysoConfigFile.channel ?? kysoConfigFile.team,
        },
      });
      reportDto = response.data.data;
      const reportUrl = `${kysoCredentials.kysoInstallUrl}/${reportDto.organization_sluglified_name}/${reportDto.team_sluglified_name}/${reportDto.name}`;
      this.log(`🎉🎉🎉 Report ${reportDto.title} was uploaded to: ${reportUrl} 🎉🎉🎉\n`);
    } catch (e: any) {
      const errorResponse: ErrorResponse = e.response.data;
      this.log(`\nError: ${errorResponse.message}.\n`);
    } finally {
      try {
        rmSync(outputFilePath, { force: true });
      } catch (e) {
        this.log(`\nTemporary file can't be deleted.\n`);
      }
    }
    return reportDto;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Push);

    if (flags.verbose) {
      this.log('Enabled verbose mode');
      this.enableVerbose();
    }

    await launchInteractiveLoginIfNotLogged();

    if (!existsSync(flags.path)) {
      this.error('Invalid path');
    }

    let basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path);
    if (basePath.endsWith('/') || basePath.endsWith('\\')) {
      basePath = basePath.slice(0, -1);
    }

    const { singleFileReports, reportFiles } = this.getFiles(basePath);
    for (const reportSingleFile of singleFileReports) {
      await this.uploadSimpleFile(basePath, reportSingleFile, flags.message);
    }
    await this.uploadReport(reportFiles, basePath, flags.message);

    if (flags.verbose) {
      this.log('Disabling verbose mode');
      this.disableVerbose();
    }
  }
}

/* eslint-disable complexity */
/* eslint-disable no-await-in-loop */
import { File as KysoFile, KysoConfigFile, KysoSettingsEnum, NormalizedResponseDTO, ReportDTO, ReportPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api, createKysoReportAction, setOrganizationAuthAction, setTeamAuthAction, store, updateKysoReportAction } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { isAbsolute, join } from 'path';
import { findKysoConfigFile } from '../helpers/find-kyso-config-file';
import { getAllFiles } from '../helpers/get-all-files';
import { getValidFiles } from '../helpers/get-valid-files';
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login';
import slugify from '../helpers/slugify';
import { KysoCredentials } from '../types/kyso-credentials';
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

  private async uploadReportAux(reportFolder: string, basePath: string, pushMessage: string): Promise<void> {
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api(kysoCredentials.token);

    const filesBasePath: string[] = readdirSync(basePath).map((file: string) => join(basePath, file));
    const { kysoConfigFile, valid, message, kysoConfigPath } = findKysoConfigFile(filesBasePath);
    if (!valid) {
      this.log(`\nError: Could not pull report of '${reportFolder}' folder using Kyso config file: ${message}\n`);
      return;
    }
    const { payload }: any = jwtDecode(kysoCredentials.token);
    const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(payload.username);
    const tokenPermissions: TokenPermissions = resultPermissions.data;
    const indexOrganization: number = tokenPermissions.organizations.findIndex(
      (resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === kysoConfigFile.organization,
    );
    if (indexOrganization === -1) {
      this.log(`\nError: You don't have permissions to create reports in the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`);
      return;
    }
    let teamId: string | null = null;
    try {
      const resultCheckPermission: NormalizedResponseDTO<boolean> = await api.checkPermission({
        organization: kysoConfigFile.organization,
        team: kysoConfigFile.team,
        permission: ReportPermissionsEnum.CREATE,
      });
      if (resultCheckPermission.data) {
        const indexTeam: number = tokenPermissions.teams.findIndex(
          (resourcePermissionTeam: ResourcePermissions) =>
            resourcePermissionTeam.name === kysoConfigFile.team && resourcePermissionTeam.organization_id === tokenPermissions.organizations[indexOrganization].id,
        );
        if (indexTeam > -1) {
          teamId = tokenPermissions.teams[indexTeam].id;
        } else {
          this.log(
            `\nError: You don't have permission to create reports in the '${kysoConfigFile.team}' team of the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`,
          );
          return;
        }
      } else {
        this.log(
          `\nError: You don't have permission to create reports in the '${kysoConfigFile.team}' team of the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`,
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

    const validFiles: { path: string; sha: string }[] = getValidFiles(basePath);
    let newFiles: string[] = [];
    const unmodifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    let reportDto: ReportDTO | null = null;
    let version = 1;
    try {
      const reportSlug: string = slugify(kysoConfigFile.title);
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
        this.log(`\nNo new or modified files to upload in the '${reportFolder}' folder.\n`);
        return;
      }
      reportFiles.forEach((reportFile: KysoFile) => {
        const indexFile: number = validFiles.findIndex((validFile: { path: string; sha: string }) => reportFile.sha === validFile.sha);
        if (indexFile === -1) {
          deletedFiles.push(reportFile.id);
        }
      });
    } catch (error: any) {
      const errorData: { statusCode: number; message: string; error: string } = error.response.data;
      if (errorData.statusCode === 404) {
        newFiles = validFiles.map((file: { path: string; sha: string }) => file.path);
      }
    }

    // Check if report has defined main file
    if (kysoConfigFile.main && validFiles.length > 0) {
      const indexMainFile: number = validFiles.findIndex((file: { path: string; sha: string }) => {
        let validFilePathWithoutBasePath: string = basePath === '.' ? file.path : file.path.replace(basePath, '');
        if (validFilePathWithoutBasePath.startsWith('/')) {
          validFilePathWithoutBasePath = validFilePathWithoutBasePath.slice(1);
        }
        return validFilePathWithoutBasePath === kysoConfigFile.main;
      });
      if (indexMainFile === -1) {
        this.log(`\nError: Main file '${kysoConfigFile.main}' defined in the '${reportFolder}' folder does not exist.\n`);
        return;
      }
    }

    // Check if kysoConfigFile has defined authors
    if (!kysoConfigFile.authors || kysoConfigFile.authors.length === 0) {
      kysoConfigFile.authors = [payload.email];
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
      const url = `${kysoCredentials.kysoInstallUrl}/api/v1/reports/kyso/XXXX`;
      await axios.put(url, {});
    } catch (error: any) {
      const errorResponse: { statusCode: number; message: string; error: string } = error.response.data;
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
        }),
      );
    } else {
      result = await store.dispatch(
        createKysoReportAction({
          filePaths: getAllFiles(basePath, []),
          basePath,
          maxFileSizeStr: resultKysoSettings.data || '500mb',
          message: pushMessage,
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

  private async uploadReport(basePath: string, pushMessage: string): Promise<void> {
    // Check if report is a multiple report
    const files: string[] = readdirSync(basePath).map((file: string) => join(basePath, file));
    let mainKysoConfigFile: KysoConfigFile | null = null;
    const data: { kysoConfigFile: KysoConfigFile; valid: boolean; message: string } = findKysoConfigFile(files);
    if (!data.valid) {
      this.log(`Error in Kyso config file: ${data.message}`);
      return;
    }
    mainKysoConfigFile = data.kysoConfigFile;

    if (mainKysoConfigFile?.reports) {
      this.log(`\n${mainKysoConfigFile.reports.length} ${mainKysoConfigFile.reports.length > 1 ? 'reports' : 'report'} found\n`);
      for (const reportFolder of mainKysoConfigFile.reports) {
        // Check if folder exists
        const reportPath: string = join(basePath, reportFolder);
        if (!existsSync(reportPath)) {
          this.error(`Report '${reportFolder}' folder does not exist.`);
        }
        const filesBasePath: string[] = readdirSync(reportPath).map((file: string) => join(reportPath, file));
        const { valid, message } = findKysoConfigFile(filesBasePath);
        if (!valid) {
          this.error(`Folder '${reportFolder}' does not have a valid Kyso config file: ${message}`);
        }
        await this.uploadReportAux(reportFolder, reportPath, pushMessage);
      }
    } else {
      const parts: string[] = basePath.split('/');
      const reportFolder: string = parts[parts.length - 1];
      await this.uploadReportAux(reportFolder, basePath, pushMessage);
    }
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

    if (!lstatSync(flags.path).isDirectory()) {
      this.error('Path must be a directory');
    }

    const basePath: string = isAbsolute(flags.path) ? flags.path : join('.', flags.path);
    await this.uploadReport(basePath, flags.message);

    if (flags.verbose) {
      this.log('Disabling verbose mode');
      this.disableVerbose();
    }
  }
}

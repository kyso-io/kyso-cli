/* eslint-disable complexity */
/* eslint-disable no-await-in-loop */
import { CheckPermissionDto, File as KysoFile, KysoConfigFile, NormalizedResponseDTO, ReportDTO, ReportPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import color from '@oclif/color';
import { Flags } from '@oclif/core';
import { existsSync, lstatSync, readdirSync } from 'fs';
import jwtDecode from 'jwt-decode';
import moment from 'moment';
import { join, resolve } from 'path';
import { Helper } from '../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login';
import { ErrorResponse } from '../types/error-response';
import { KysoCredentials } from '../types/kyso-credentials';
import { KysoCommand } from './kyso-command';

export default class Status extends KysoCommand {
  static description = 'Show the working tree status';

  static examples = [`$ kyso status --path ./my-report`];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Path to root folder of the report to push. Default is "."',
      required: false,
      default: '.',
    }),
  };

  static args = [];

  private async reportStatus(reportFolder: string, basePath: string): Promise<void> {
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api(kysoCredentials.token);
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials.token);

    const filesBasePath: string[] = readdirSync(basePath).map((file: string) => join(basePath, file));
    const { kysoConfigFile, valid, message } = Helper.findKysoConfigFile(filesBasePath);
    if (!valid) {
      this.log(`\nError: Could not pull report of '${reportFolder}' folder using Kyso config file: ${message}\n`);
      return;
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
    if (indexOrganization === -1) {
      this.log(`\nError: You don't have permissions to create reports in the '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`);
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
          this.log(`\nError: You don't have permission to get reports in '${kysoConfigFile.team}' channel of '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`);
          return;
        }
      } else {
        this.log(`\nError: You don't have permission to get reports in '${kysoConfigFile.team}' channel of '${kysoConfigFile.organization}' organization defined in the '${reportFolder}' folder.\n`);
        return;
      }
    } catch (error: any) {
      this.log(`\nError: ${error.response.data.message}\n`);
      return;
    }

    const validFiles: { name: string; sha: string }[] = Helper.getValidFiles(basePath).map((validFile: { path: string; sha: string }) => {
      let name: string = basePath === '.' ? validFile.path : validFile.path.replace(basePath, '');
      if (name.startsWith('/')) {
        name = name.slice(1);
      }
      return { name, sha: validFile.sha };
    });
    const newFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const unmodifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    let reportDto: ReportDTO | null = null;
    try {
      const reportSlug: string = Helper.slug(kysoConfigFile.title);
      const resultReport: NormalizedResponseDTO<ReportDTO> = await api.getReportByTeamIdAndSlug(teamId, reportSlug);
      reportDto = resultReport.data;
      const resultFiles: NormalizedResponseDTO<KysoFile[]> = await api.getReportFiles(reportDto.id, reportDto.last_version);
      const reportFiles: KysoFile[] = resultFiles.data;
      validFiles.forEach((validFile: { name: string; sha: string }) => {
        const indexFile: number = reportFiles.findIndex((reportFile: KysoFile) => reportFile.name === validFile.name);
        if (indexFile === -1) {
          newFiles.push(validFile.name);
        } else {
          if (reportFiles[indexFile].sha === validFile.sha) {
            unmodifiedFiles.push(reportFiles[indexFile].name);
          } else {
            modifiedFiles.push(reportFiles[indexFile].name);
          }
        }
      });
      reportFiles.forEach((reportFile: KysoFile) => {
        const indexFile: number = validFiles.findIndex((validFile: { name: string; sha: string }) => reportFile.sha === validFile.sha && reportFile.name === validFile.name);
        if (indexFile === -1) {
          const indexModified: number = modifiedFiles.findIndex((modifiedFile: string) => modifiedFile === reportFile.name);
          if (indexModified === -1) {
            deletedFiles.push(reportFile.name);
          }
        }
      });
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      if (errorResponse.statusCode === 404) {
        this.error(`Report '${kysoConfigFile.title}' not found in '${kysoConfigFile.team}' channel of '${kysoConfigFile.organization}' organization`);
      }
    }

    this.log(`\nReport '${reportDto.title}'\n`);
    this.log(`Url: ${kysoCredentials.kysoInstallUrl}/${reportDto.organization_sluglified_name}/${reportDto.team_sluglified_name}/${reportDto.name}`);
    this.log(`Organization: ${kysoConfigFile.organization}`);
    this.log(`Channel: ${kysoConfigFile.team}`);
    this.log(`Version: ${reportDto.last_version}`);
    this.log(`Created at: ${moment(reportDto.created_at).format('DD/MM/YYYY HH:mm:ss')}`);
    this.log(`Updated at: ${moment(reportDto.updated_at).format('DD/MM/YYYY HH:mm:ss')}`);

    if (unmodifiedFiles.length === 0 && newFiles.length === 0 && modifiedFiles.length === 0 && deletedFiles.length === 0) {
      this.log(`\nReport is up to date`);
    } else {
      if (unmodifiedFiles.length > 0) {
        this.log(`\nUnmodified files: ${unmodifiedFiles.length}`);
      }
      if (newFiles.length > 0) {
        this.log(`\nNew files: ${newFiles.length}`);
        newFiles.forEach((newFile: string) => this.log(color.green(`\t${newFile}`)));
      }
      if (modifiedFiles.length > 0) {
        this.log(`\nModified files: ${modifiedFiles.length}`);
        modifiedFiles.forEach((modifiedFile: string) => this.log(color.yellow(`\t${modifiedFile}`)));
      }
      if (deletedFiles.length > 0) {
        this.log(`\nDeleted files: ${deletedFiles.length}`);
        deletedFiles.forEach((deletedFile: string) => this.log(color.red(`\t${deletedFile}`)));
      }
    }
    this.log(``);
  }

  private async evaluatePath(basePath: string): Promise<void> {
    // Check if report is a multiple report
    const files: string[] = readdirSync(basePath).map((file: string) => join(basePath, file));
    let mainKysoConfigFile: KysoConfigFile | null = null;
    const data: { kysoConfigFile: KysoConfigFile; valid: boolean; message: string } = Helper.findKysoConfigFile(files);
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
        const { valid, message } = Helper.findKysoConfigFile(filesBasePath);
        if (!valid) {
          this.error(`Folder '${reportFolder}' does not have a valid Kyso config file: ${message}`);
        }
        await this.reportStatus(reportFolder, reportPath);
      }
    } else {
      const parts: string[] = basePath.split('/');
      const reportFolder: string = parts[parts.length - 1];
      await this.reportStatus(reportFolder, basePath);
    }
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(Status);
    await launchInteractiveLoginIfNotLogged();
    if (!existsSync(flags.path)) {
      this.error('Invalid path');
    }
    if (!lstatSync(flags.path).isDirectory()) {
      this.error('Path must be a directory');
    }
    const basePath: string = resolve(flags.path);
    await this.evaluatePath(basePath);
  }
}

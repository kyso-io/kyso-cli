/* eslint-disable complexity */
/* eslint-disable max-params */
import type { NormalizedResponseDTO, Organization, Team } from '@kyso-io/kyso-model';
import { TeamVisibilityEnum } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import AdmZip from 'adm-zip';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import { Helper } from '../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../helpers/interactive-login';
import type { ErrorResponse } from '../types/error-response';
import type { KysoCredentials } from '../types/kyso-credentials';
import { KysoCommand } from './kyso-command';

export default class Clone extends KysoCommand {
  static description = 'Clone a report from Kyso';

  static examples = [`$ kyso clone <report_url>`];

  static flags = {
    path: Flags.string({
      char: 'p',
      description: 'Destination folder in which the report will be pulled',
      required: false,
      default: '.',
    }),
    version: Flags.integer({
      char: 'v',
      description: 'Version of the report to be pulled. Latest version is pulled if not set',
      required: false,
    }),
    verbose: Flags.boolean({
      char: 'x',
      description: 'Verbose mode for debugging',
      required: false,
      default: false,
    }),
  };

  static args = [{ name: 'cloneUrl' }];

  async run(): Promise<void> {
    const { flags } = await this.parse(Clone);

    if (flags.verbose) {
      this.log('Enabled verbose mode');
      this.enableVerbose();
    }

    const parsed = await this.parse(Clone);
    const { cloneUrl } = parsed.args;

    if (!cloneUrl) {
      this.log('\nError: Must provide the report URL\n');
      return;
    }

    const urlParts: string[] = cloneUrl.replace('https://', '').replace('http://', '').split('/');
    const organizationSlug: string = urlParts[1];
    const teamSlug: string = urlParts[2];
    const reportSlug: string = urlParts[3];
    if (!organizationSlug || !teamSlug || !reportSlug) {
      this.error('Invalid report URL');
    }
    let baseUrl = cloneUrl.replace(`/${organizationSlug}/${teamSlug}/${reportSlug}`, '');
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(`${baseUrl}/api/v1`, kysoCredentials?.token);
    let organization: Organization | null = null;
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(organizationSlug);
      organization = resultOrganization.data;
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      if (errorResponse.statusCode === 404) {
        this.log(`\nError: Organization ${organizationSlug} does not exist.\n`);
      } else {
        this.log(`\nError: ${errorResponse.message}.\n`);
      }
      return;
    }
    // Check if team is public
    try {
      const resultTeam: NormalizedResponseDTO<Team> = await api.getTeamBySlug(organization.id, teamSlug);
      const team: Team = resultTeam.data;
      if (team.visibility !== TeamVisibilityEnum.PUBLIC) {
        await launchInteractiveLoginIfNotLogged();
      }
    } catch (error: any) {
      const errorResponse: ErrorResponse = error.response.data;
      if (errorResponse.statusCode === 404) {
        this.log(`\nError: Channel ${teamSlug} does not exist.\n`);
      } else if (errorResponse.statusCode === 403) {
        if (kysoCredentials?.token) {
          this.log(`\nError: ${errorResponse.message}\n`);
        } else {
          await launchInteractiveLoginIfNotLogged();
          this.run();
        }
      } else {
        Helper.printErrorMessage(error);
      }
      return;
    }

    this.log(`\n✨✨✨ Cloning ${cloneUrl} ✨✨✨\n`);

    try {
      let files: string[] = readdirSync(flags.path);

      if (organizationSlug && teamSlug && reportSlug) {
        await this.extractReport(baseUrl, organizationSlug, teamSlug, reportSlug, flags.version, flags.path);
      } else {
        if (flags?.path) {
          files = files.map((file: string) => join(flags.path, file));
        }
        const { kysoConfigFile, valid, message } = Helper.findKysoConfigFile(files);
        if (!valid) {
          this.error(`Could not clone report using Kyso config file: ${message}`);
        }
        this.extractReport(baseUrl, kysoConfigFile.organization, kysoConfigFile.team, kysoConfigFile.title, flags.version, flags.path);
      }
    } catch (error: any) {
      try {
        const errorResponse: ErrorResponse = JSON.parse(error.response.data.toString());
        this.log(`Error: ${errorResponse.message}`);
      } catch {
        Helper.printErrorMessage(error);
      }
    }

    if (flags.verbose) {
      this.log('Disabling verbose mode');
      this.disableVerbose();
    }
  }

  async extractReport(baseUrl: string, organization: string, team: string, report: string, version: number | null, path: string): Promise<void> {
    const api: Api = new Api();
    api.configure(`${baseUrl}/api/v1`, KysoCommand.getCredentials()?.token, organization, team);
    const finalPath: string = `${path}/${report}`;
    const result: Buffer = await api.pullReport(report, team, version);
    const zip: AdmZip = new AdmZip(result);
    zip.extractAllTo(finalPath, true);
    this.log(`\n🎉🎉🎉 Success! Report downloaded to ${resolve(finalPath)} 🎉🎉🎉\n`);
  }
}

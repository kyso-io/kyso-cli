import { GlobalPermissionsEnum, NormalizedResponseDTO, Organization, OrganizationPermissionsEnum, ResourcePermissions, Team, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { resolve } from 'path';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import slug from '../../helpers/slugify';
import { KysoCredentials } from '../../types/kyso-credentials';
import { OrganizationData } from '../../types/organization-data';
import { KysoCommand } from '../kyso-command';

export default class OrganizationsGet extends KysoCommand {
  static description =
    'Save the configuration values (profile data, access settings and list of channels) of the organizations in the comma_separated_list_of_orgs on a yaml_file.\nIf the --images flag is passed the <yaml_file> will contain copies of the background and photo images encoded in base64.\nIf the --no-channels flag is passed the <yaml_file> will not include the list of channels for the organizations.';

  static examples = [
    `$ kyso organization get <list_of_orgs> <yaml_file>`,
    `$ kyso organization get <list_of_orgs> <yaml_file> --images`,
    `$ kyso organization get <list_of_orgs> <yaml_file> --no-channels`,
    `$ kyso organization get <list_of_orgs> <yaml_file> --images --no-channels`,
  ];

  static flags = {
    images: Flags.boolean({
      char: 'i',
      description: 'Get organization image in base64 format',
      required: false,
      default: false,
    }),
    channels: Flags.boolean({
      char: 'c',
      description: 'Get organization channels',
      required: false,
      default: true,
      allowNo: true,
    }),
  };

  static args = [
    {
      name: 'list_of_orgs',
      description: 'List of organizations separated by commas',
      required: true,
    },
    {
      name: 'yaml_file',
      description: 'Yaml file where the organization data will be saved',
      required: true,
    },
  ];

  private async getOrganizationData(api: Api, tokenPermissions: TokenPermissions, organizationSlug: string, getChannels: boolean, getImages: boolean): Promise<OrganizationData> {
    let organizationData: OrganizationData | null = null;
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organizationSlug);
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to get the information for the organization '${organizationSlug}'`);
      return organizationData;
    }
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const isOrgAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!isOrgAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to get the information for the organization '${organizationSlug}'`);
      return organizationData;
    }
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    let organization: Organization | null = null;
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(organizationSlug);
      organization = resultOrganization.data;
      organizationData = {
        slug: organization.sluglified_name,
        display_name: organization.display_name,
        allowed_access_domains: organization.allowed_access_domains,
        location: organization.location,
        link: organization.link,
        bio: organization.bio,
        channels: [],
        options: {
          auth: {
            otherProviders: organization.options?.auth?.otherProviders || [],
          },
          notifications: {
            centralized: organization.options?.notifications?.centralized || false,
            emails: organization.options?.notifications?.emails || [],
          },
        },
      };
      if (getChannels) {
        api.setOrganizationSlug(organizationSlug);
        const resultTeams: NormalizedResponseDTO<Team[]> = await api.getTeams({
          page: 1,
          per_page: 10000,
          filter: {
            organization_id: organization.id,
          },
        });
        const teams: Team[] = resultTeams.data;
        organizationData.channels = teams.map((team: Team) => team.sluglified_name);
      }
      if (getImages) {
        if (organization.avatar_url) {
          try {
            const imageUrl: string = organization.avatar_url.startsWith('http') ? organization.avatar_url : kysoCredentials.kysoInstallUrl + organization.avatar_url;
            const axiosResponse = await axios.get(imageUrl, { responseType: 'text', responseEncoding: 'base64' });
            if (axiosResponse.status === 200) {
              organizationData.photo = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
            }
          } catch (e) {
            console.log(e);
          }
        }
      }
      return organizationData;
    } catch (e) {
      return organizationData;
    }
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(OrganizationsGet);

    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('Yaml file name must end with .yaml or .yml');
    }

    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();

    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const organizationsSlugs: string[] = await Helper.getRealOrganizationSlugFromStringArray(args.list_of_orgs, kysoCredentials);

    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    let tokenPermissions: TokenPermissions | null = null;
    try {
      const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
      tokenPermissions = resultPermissions.data;
    } catch (e) {
      this.error('Error getting user permissions');
    }
    const result: OrganizationData[] = [];
    for (const organizationSlug of organizationsSlugs) {
      const organizationData: OrganizationData = await this.getOrganizationData(api, tokenPermissions, organizationSlug, flags.channels, flags.images);
      if (!organizationData) {
        continue;
      }
      result.push(organizationData);
    }
    if (result.length === 0) {
      this.log('No organizations found');
      return;
    }
    const yamlData: string = jsYaml.dump(result);
    const yamlFilePath: string = resolve(args.yaml_file);
    writeFileSync(yamlFilePath, yamlData);
    this.log(`Organizations data saved in ${yamlFilePath}`);
  }
}

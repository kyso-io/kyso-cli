import { GlobalPermissionsEnum, NormalizedResponseDTO, Organization, OrganizationPermissionsEnum, ResourcePermissions, Team, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import { resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { OrganizationData } from '../../types/organization-data';
import { KysoCommand } from '../kyso-command';

export default class OrganizationGet extends KysoCommand {
  static description = 'Save in a yaml file the organization data';

  static examples = [
    `$ kyso organization get get <list_of_orgs> <yaml_file>`,
    `$ kyso organization get get <list_of_orgs> <yaml_file> --images`,
    `$ kyso organization get get <list_of_orgs> <yaml_file> --no-channels`,
    `$ kyso organization get get <list_of_orgs> <yaml_file> --images --no-channels`,
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
      description: 'Yaml file name where the user profile data will be saved',
      required: true,
    },
  ];

  private async getOrganizationData(api: Api, tokenPermissions: TokenPermissions, organizationSlug: string, getChannels: boolean, getImages: boolean): Promise<OrganizationData> {
    let organizationData: OrganizationData | null = null;
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organizationSlug);
    if (indexOrganization === -1) {
      this.log(`Error: You don't have permissions to get the information for the organization ${organizationSlug}`);
      return organizationData;
    }
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    const isOrgAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!isOrgAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to get the information for the organization ${organizationSlug}`);
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
    const { args, flags } = await this.parse(OrganizationGet);
    const organizationsNames: string[] = args.list_of_orgs.split(',');
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('Yaml file name must end with .yaml or .yml');
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
    const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
    const tokenPermissions: TokenPermissions = resultPermissions.data;
    const result: OrganizationData[] = [];
    for (const organizationName of organizationsNames) {
      const organizationData: OrganizationData = await this.getOrganizationData(api, tokenPermissions, organizationName, flags.channels, flags.images);
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

import { GlobalPermissionsEnum, NormalizedResponseDTO, Organization, OrganizationPermissionsEnum, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import axios from 'axios';
import { createReadStream, existsSync, readFileSync, ReadStream, unlinkSync, writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import * as _ from 'lodash';
import { join } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { OrganizationData } from '../../types/organization-data';
import { KysoCommand } from '../kyso-command';

export default class OrganizationSet extends KysoCommand {
  static description = 'Update organization data given yaml file';

  static examples = [`$ kyso organization set <yaml_file>`];

  static args = [
    {
      name: 'yaml_file',
      description: 'Yaml file with user profile data',
      required: true,
    },
  ];

  private async updatePhoto(api: Api, organizationId: string, photoBase64: string): Promise<void> {
    if (!photoBase64.startsWith('data:image/')) {
      this.log('Error: Photo must be a base64 string');
      return;
    }
    try {
      // Create file from base64 string
      const formatImage: string = photoBase64.split(';')[0].split('/')[1];
      const imageFilePath: string = join(KysoCommand.DATA_DIRECTORY, `organization-${organizationId}-photo-${new Date().getTime()}.${formatImage}`);
      const buffer: Buffer = Buffer.from(photoBase64.split(',')[1], 'base64');
      writeFileSync(imageFilePath, buffer);
      const readStream: ReadStream = createReadStream(imageFilePath);
      await api.uploadOrganizationImage(organizationId, readStream);
      unlinkSync(imageFilePath);
    } catch (e: any) {
      this.log(`Error uploading photo: ${e.response.data.message}`);
    }
  }

  private async updateOrganization(api: Api, tokenPermissions: TokenPermissions, organizationData: OrganizationData): Promise<void> {
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organizationData.slug);
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    if (indexOrganization === -1) {
      this.log(`Error: You don't belong to the organization ${organizationData.slug}`);
      return;
    }
    const isOrgAdmin: boolean = resourcePermissions.permissions.includes(OrganizationPermissionsEnum.ADMIN);
    const isGlobalAdmin: boolean = tokenPermissions.global.includes(GlobalPermissionsEnum.GLOBAL_ADMIN);
    if (!isOrgAdmin && !isGlobalAdmin) {
      this.log(`Error: You don't have permissions to get the information for the organization ${organizationData.slug}`);
      return;
    }
    let organization: Organization | null = null;
    let photoBase64: string | null = null;
    try {
      const resultOrganization: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(organizationData.slug);
      organization = resultOrganization.data;
    } catch (e) {
      this.log(`Error: Organization ${organizationData.slug} does not exist`);
      return;
    }
    if (organization.avatar_url) {
      try {
        const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
        const imageUrl: string = organization.avatar_url.startsWith('http') ? organization.avatar_url : kysoCredentials.kysoInstallUrl + organization.avatar_url;
        const axiosResponse = await axios.get(imageUrl, { responseType: 'text', responseEncoding: 'base64' });
        if (axiosResponse.status === 200) {
          photoBase64 = `data:${axiosResponse.headers['content-type']};base64,${axiosResponse.data}`;
        }
      } catch (e) {
        console.log(e);
      }
    }
    let updatedPhoto = false;
    if ((!photoBase64 && organizationData.photo) || (photoBase64 && organizationData.photo && photoBase64 !== organizationData.photo)) {
      await this.updatePhoto(api, organization.id, organizationData.photo);
      updatedPhoto = true;
    }
    const updateOrganizationDto: any = {};
    if (organizationData.display_name && organizationData.display_name !== organization.display_name) {
      updateOrganizationDto.display_name = organizationData.display_name;
    }
    if (organizationData.allowed_access_domains) {
      if (!organization.allowed_access_domains) {
        updateOrganizationDto.allowed_access_domains = [...organizationData.allowed_access_domains];
      } else if (organization.allowed_access_domains.length !== organizationData.allowed_access_domains.length) {
        updateOrganizationDto.allowed_access_domains = [...organizationData.allowed_access_domains];
      } else {
        for (let i = 0; i < organization.allowed_access_domains.length; i++) {
          if (organization.allowed_access_domains[i] !== organizationData.allowed_access_domains[i]) {
            updateOrganizationDto.allowed_access_domains = [...organizationData.allowed_access_domains];
            break;
          }
        }
      }
    }
    if (organizationData.location && organizationData.location !== organization.location) {
      updateOrganizationDto.location = organizationData.location;
    }
    if (organizationData.link && organizationData.link !== organization.link) {
      updateOrganizationDto.link = organizationData.link;
    }
    if (organizationData.bio && organizationData.bio !== organization.bio) {
      updateOrganizationDto.bio = organizationData.bio;
    }
    const options: any = {};
    if (organizationData?.options?.auth) {
      const objectToCompare = { otherProviders: organization.options?.auth?.otherProviders };
      if (!_.isEqual(organizationData.options.auth, objectToCompare)) {
        options.auth = { ...organizationData.options.auth };
      }
    }
    if (organizationData?.options?.notifications) {
      const objectToCompare = { centralized: organization.options?.notifications?.centralized, emails: organization?.options?.notifications?.emails };
      if (!_.isEqual(organizationData.options.notifications, objectToCompare)) {
        options.notifications = { ...organizationData.options.notifications };
      }
    }
    if (Object.keys(options).length > 0) {
      updateOrganizationDto.options = options;
    }
    if (Object.keys(updateOrganizationDto).length > 0) {
      try {
        api.setOrganizationSlug(organizationData.slug);
        await api.updateOrganization(organization.id, updateOrganizationDto);
        this.log(`Organization ${organizationData.slug} updated`);
      } catch (e: any) {
        this.log(`Error updating organization ${organizationData.slug}: ${e.response.data.message}`);
      }
    } else {
      if (!updatedPhoto) {
        this.log(`No changes to update for the organization ${organizationData.slug}`);
      }
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(OrganizationSet);
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('File is not a yaml file');
    }
    if (!existsSync(args.yaml_file)) {
      this.log(`File ${args.yaml_file} does not exist`);
      return;
    }
    // Read yaml file
    const yamlFileContent: string = readFileSync(args.yaml_file, 'utf8');
    let organizationsData: OrganizationData[] | null = null;
    try {
      organizationsData = jsYaml.load(yamlFileContent) as OrganizationData[];
      if (!Array.isArray(organizationsData)) {
        this.error('File is not an array of organizations');
      }
    } catch (e) {
      this.error('File is not a valid yaml file');
    }
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
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
    for (const organizationData of organizationsData) {
      if (!organizationData.slug) {
        continue;
      }
      await this.updateOrganization(api, tokenPermissions, organizationData);
    }
  }
}

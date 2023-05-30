import type { NormalizedResponseDTO, Organization, ResourcePermissions, TokenPermissions } from '@kyso-io/kyso-model';
import { OrganizationNotificationsDTO, OrganizationOptionsDTO, UpdateOrganizationDTO } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import axios from 'axios';
import type { ReadStream } from 'fs';
import { createReadStream, existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import * as jsYaml from 'js-yaml';
import jwtDecode from 'jwt-decode';
import * as _ from 'lodash';
import { join } from 'path';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { KysoCredentials } from '../../types/kyso-credentials';
import type { OrganizationData } from '../../types/organization-data';
import { KysoCommand } from '../kyso-command';

export default class OrganizationsSet extends KysoCommand {
  static description =
    'Pass the organizations configuration values from the yaml_file to the backend and merge its values with the existing ones (that is, missing values keep their value).\nThis command does not get the organization names from the command line because we can pass multiple organizations on the YAML file and each of them includes its name.\nNote that when updating the information of an organization the list of channels is not used, that is, no channel is added or removed with this command, to manage channels you should use the channel subcommand.';

  static examples = [`$ kyso organization set <yaml_file>`];

  static args = [
    {
      name: 'yaml_file',
      description: 'Yaml file with organizations data',
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

  private async updateOrganization(api: Api, tokenPermissions: TokenPermissions, organizationData: OrganizationData, kysoCredentials: KysoCredentials): Promise<void> {
    const indexOrganization: number = tokenPermissions.organizations.findIndex((resourcePermissionOrganization: ResourcePermissions) => resourcePermissionOrganization.name === organizationData.slug);
    const resourcePermissions: ResourcePermissions = tokenPermissions.organizations[indexOrganization];
    if (indexOrganization === -1 && !Helper.isGlobalAdmin(tokenPermissions)) {
      this.log(`Error: You don't belong to the organization ${organizationData.slug}`);
      return;
    }

    const isOrgAdmin: boolean = Helper.isOrganizationAdmin(resourcePermissions);
    const isGlobalAdmin: boolean = Helper.isGlobalAdmin(tokenPermissions);

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
    const updateOrganizationDto: UpdateOrganizationDTO = UpdateOrganizationDTO.createEmpty();

    if (organizationData.display_name && organizationData.display_name !== organization.display_name) {
      this.log(`Organization display_name changed from ${organization.display_name} to ${organizationData.display_name}`);
      updateOrganizationDto.display_name = organizationData.display_name;
    } else {
      updateOrganizationDto.display_name = organization.display_name;
    }

    if (organizationData.location && organizationData.location !== organization.location) {
      this.log(`Organization location changed from ${organization.location} to ${organizationData.location}`);
      updateOrganizationDto.location = organizationData.location;
    } else {
      updateOrganizationDto.location = organization.location;
    }

    if (organizationData.link && organizationData.link !== organization.link) {
      this.log(`Organization link changed from ${organization.link} to ${organizationData.link}`);
      updateOrganizationDto.link = organizationData.link;
    } else {
      updateOrganizationDto.link = organization.link;
    }

    if (organizationData.bio && organizationData.bio !== organization.bio) {
      this.log(`Organization bio changed from ${organization.bio} to ${organizationData.bio}`);
      updateOrganizationDto.bio = organizationData.bio;
    } else {
      updateOrganizationDto.bio = organization.bio;
    }

    if (organizationData.allowed_access_domains) {
      if (!organization.allowed_access_domains) {
        this.log(`Added new allowed access domains ${organizationData.allowed_access_domains.join(',')}`);
        updateOrganizationDto.allowed_access_domains = [...organizationData.allowed_access_domains];
      } else if (organization.allowed_access_domains.length !== organizationData.allowed_access_domains.length) {
        this.log(`Changed allowed access domains to ${organizationData.allowed_access_domains.join(',')}`);
        updateOrganizationDto.allowed_access_domains = [...organizationData.allowed_access_domains];
      } else {
        for (let i = 0; i < organization.allowed_access_domains.length; i++) {
          if (organization.allowed_access_domains[i] !== organizationData.allowed_access_domains[i]) {
            this.log(`Changed allowed access domains to ${organizationData.allowed_access_domains.join(',')}`);
            updateOrganizationDto.allowed_access_domains = [...organizationData.allowed_access_domains];
            break;
          }
        }
      }
    }

    const options: OrganizationOptionsDTO = OrganizationOptionsDTO.createEmpty();

    if (organizationData?.options?.notifications) {
      const objectToCompare = { centralized: organization.options?.notifications?.centralized, emails: organization?.options?.notifications?.emails };
      if (!_.isEqual(organizationData.options.notifications, objectToCompare)) {
        if (organizationData.options.notifications.centralized && organizationData.options.notifications.emails.length === 0) {
          // Centralized notifications activated but without any email. Show error and don't update
          this.log('Warning: enabled centralized communications without any configured mail. This change will not be applied');
        } else {
          options.notifications = new OrganizationNotificationsDTO(organizationData.options.notifications.centralized, organizationData.options.notifications.emails, '', '', '');
        }
      }
    }
    if (Object.keys(options).length > 0) {
      updateOrganizationDto.options = options;
    }

    // Check channels and create if not exists
    const unexistingChannels: string[] = [];
    for (const channelSlug of organizationData.channels) {
      try {
        await Helper.getChannelFromSlugSecurely(organization, channelSlug, kysoCredentials, true);
      } catch (e) {
        // If an exception is raised means that the channel doesn't exists in that organization
        this.log(`Specified ${channelSlug} channel does not exist in organization ${organization.display_name}.`);
        unexistingChannels.push(channelSlug);
      }
    }

    if (unexistingChannels.length > 0) {
      this.log('\nTo create unexisting channels please run the following command');
      this.log(`    kyso channel add ${organization.sluglified_name} ${unexistingChannels.join(',')}\n`);
    }

    if (Object.keys(updateOrganizationDto).length > 0) {
      try {
        api.setOrganizationSlug(organizationData.slug);

        await api.updateOrganization(organization.id, updateOrganizationDto);
      } catch (e: any) {
        this.log(`Error updating organization ${organizationData.slug}: ${e.response.data.message}`);
      }
    } else if (!updatedPhoto) {
      this.log(`No changes to update for the organization ${organizationData.slug}`);
    } else {
      this.log(`Organization '${organizationData.slug}' updated`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(OrganizationsSet);
    if (!args.yaml_file.endsWith('.yaml') && !args.yaml_file.endsWith('.yml')) {
      this.error('File is not a yaml file');
    }
    if (!existsSync(args.yaml_file)) {
      this.log(`File ${args.yaml_file} does not exist`);
      return;
    }
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
    api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials?.token);
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
        this.log(`Slug not specified for ${organizationData.display_name ? organizationData.display_name : '?'}. Ignoring it`);
        continue;
      }
      // Slug the organization to ensure that if someone introduced the name of the organization in
      // capital letters we are going to be able to answer properly
      organizationData.slug = Helper.slug(organizationData.slug);
      await this.updateOrganization(api, tokenPermissions, organizationData, kysoCredentials);
      this.log(`🎉🎉🎉 Organization ${organizationData.display_name} updated successfully 🎉🎉🎉`);
    }
  }
}

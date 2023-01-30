import { NormalizedResponseDTO, Organization } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Flags } from '@oclif/core';
import axios from 'axios';
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { launchInteractiveLoginIfNotLogged } from '../../../helpers/interactive-login';
import { KysoCredentials } from '../../../types/kyso-credentials';
import { KysoCommand } from '../../kyso-command';

export default class DownloadOrganizationPhoto extends KysoCommand {
  static description = 'Download the photo images of the given organization and save them on the provided image_file';

  static examples = [`$ kyso organization download photo <organization> <image_file>`];

  static args = [
    {
      name: 'organization',
      description: `Organization's slugified name`,
      required: true,
    },
    {
      name: 'image_file',
      description: 'Destination file name',
      required: false,
    },
  ];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(DownloadOrganizationPhoto);
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    try {
      const result: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(args.organization);
      const organization: Organization = result.data;
      if (!organization.avatar_url) {
        this.log('Organization has no photo');
        return;
      }
      const imageUrl: string = organization.avatar_url.startsWith('http') ? organization.avatar_url : kysoCredentials.kysoInstallUrl + organization.avatar_url;
      const axiosResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const urlParts: string[] = axiosResponse.request.res.responseUrl.split('/');
      if (urlParts.length === 0) {
        this.error('Error downloading photo');
      }
      const fileName: string = urlParts[urlParts.length - 1];
      if (!fileName.includes('.')) {
        this.error('User profile photo has no extension');
      }

      let downloadPathAndName: string;
      if (args.image_file) {
        downloadPathAndName = resolve(args.image_file);
      } else {
        downloadPathAndName = resolve(join('.', fileName));
      }

      writeFileSync(downloadPathAndName, axiosResponse.data, 'binary');
      this.log(`Photo downloaded to ${downloadPathAndName}`);
    } catch (e) {
      console.log(e);
      this.error('Error downloading photo');
    }
  }
}

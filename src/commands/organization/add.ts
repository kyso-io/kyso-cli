import { CreateOrganizationDto, NormalizedResponseDTO, Organization } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import inquirer = require('inquirer');

export default class AddOrganization extends KysoCommand {
  static description = 'Add organization to the system';

  static examples = [`$ kyso organization add`];

  async run(): Promise<void> {
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(kysoCredentials.kysoInstallUrl + '/api/v1', kysoCredentials?.token);
    const createOrganizationDto: CreateOrganizationDto = new CreateOrganizationDto('', '', '', '');
    const displayNameResponse: { displayName: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'displayName',
        message: 'What is the name of the organization?',
        validate: function (displayName: string) {
          if (displayName === '') {
            return 'Name cannot be empty';
          }
          return true;
        },
      },
    ]);
    createOrganizationDto.display_name = displayNameResponse.displayName;
    const locationResponse: { location: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'location',
        message: 'What is the location of the organization?',
      },
    ]);
    createOrganizationDto.location = locationResponse.location;
    const linkResponse: { link: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'link',
        message: 'What is the link of the organization?',
        validate: function (link: string) {
          if (link) {
            // Check if link is vaild url
            const urlRegex = new RegExp(
              '^(https?:\\/\\/)?' + // protocol
                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
                '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
                '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
                '(\\#[-a-z\\d_]*)?$',
              'i',
            ); // fragment locator
            if (!urlRegex.test(link)) {
              return 'Link is not a valid url';
            }
          }
          return true;
        },
      },
    ]);
    createOrganizationDto.link = linkResponse.link;
    const bioResponse: { bio: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'bio',
        message: 'What is the bio of the organization?',
      },
    ]);
    createOrganizationDto.bio = bioResponse.bio;
    try {
      const result: NormalizedResponseDTO<Organization> = await api.createOrganization(createOrganizationDto);
      const organization: Organization = result.data;
      this.log(`Organization ${result.data.display_name} created. Visit its page ${kysoCredentials.kysoInstallUrl}/${organization.sluglified_name}`);
    } catch (e: any) {
      this.log(`Error creating the organization: ${e.response.data.message}`);
    }
  }
}

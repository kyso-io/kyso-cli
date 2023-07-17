import type { NormalizedResponseDTO, Organization, TokenPermissions } from '@kyso-io/kyso-model';
import { AllowDownload, CreateOrganizationDto, KysoSettingsEnum } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import jwtDecode from 'jwt-decode';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';
import inquirer = require('inquirer');

export default class AddOrganizations extends KysoCommand {
  static description =
    'Add the organizations in the list_of_orgs to the system. This command asks interactively for the minimum data required to create them and later the user can update the information using the frontend or the get and set subcommands.';

  static examples = [`$ kyso organization add <list_of_orgs>`];

  static args = [
    {
      name: 'list_of_orgs',
      description: 'List of organizations separated by commas',
      required: true,
    },
  ];

  private async createOrganization(api: Api, organizationDisplayName: string): Promise<void> {
    const createOrganizationDto: CreateOrganizationDto = new CreateOrganizationDto(organizationDisplayName, '', '', '', AllowDownload.ALL);
    const locationResponse: { location: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'location',
        message: `What is the location of the organization '${createOrganizationDto.display_name}'?`,
      },
    ]);
    createOrganizationDto.location = locationResponse.location;
    const linkResponse: { link: string } = await inquirer.prompt([
      {
        type: 'input',
        name: 'link',
        message: `What is the link of the organization '${createOrganizationDto.display_name}'?`,
        validate(link: string) {
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
        message: `What is the bio of the organization '${createOrganizationDto.display_name}'?`,
      },
    ]);
    createOrganizationDto.bio = bioResponse.bio;
    try {
      const result: NormalizedResponseDTO<Organization> = await api.createOrganization(createOrganizationDto);
      const organization: Organization = result.data;
      const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
      this.log(`\nOrganization '${organization.display_name}' created. Visit its page ${kysoCredentials.kysoInstallUrl}/${organization.sluglified_name}\n`);
    } catch (e: any) {
      this.log(`Error creating the organization: ${e.response.data.message}`);
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(AddOrganizations);
    const organizationsNames: string[] = args.list_of_orgs.split(',');
    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();
    const api: Api = new Api();
    api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials?.token);
    try {
      const value: NormalizedResponseDTO<any> = await api.getSettingValue(KysoSettingsEnum.ONLY_GLOBAL_ADMINS_CAN_CREATE_ORGANIZATIONS);
      if (value.data === 'true' || value.data === true) {
        const decoded: { payload: any } = jwtDecode(kysoCredentials.token);
        try {
          const resultPermissions: NormalizedResponseDTO<TokenPermissions> = await api.getUserPermissions(decoded.payload.username);
          const tokenPermissions: TokenPermissions = resultPermissions.data;
          const isGlobalAdmin: boolean = Helper.isGlobalAdmin(tokenPermissions);
          if (!isGlobalAdmin) {
            this.log('You are not allowed to create organizations. Please contact your system administrator.');
            return;
          }
        } catch (e) {
          this.log('Error getting user permissions');
          return;
        }
      }
    } catch (e) {
      this.log('You are not allowed to create organizations. Please contact your system administrator.');
      return;
    }
    for (const organizationDisplayName of organizationsNames) {
      await this.createOrganization(api, organizationDisplayName);
    }
  }
}

import type { UserDTO, NormalizedResponseDTO, Organization } from '@kyso-io/kyso-model';
import { AddUserOrganizationDto } from '@kyso-io/kyso-model';
import { Api } from '@kyso-io/kyso-store';
import { Helper } from '../../helpers/helper';
import { launchInteractiveLoginIfNotLogged } from '../../helpers/interactive-login';
import type { KysoCredentials } from '../../types/kyso-credentials';
import { KysoCommand } from '../kyso-command';

export default class AddMemberToOrganization extends KysoCommand {
  static description = 'Add [LIST_OF_USER_EMAIL] users as member to [ORGANIZATION_NAME] with the desired role [ROLE].';

  static examples = [
    `# Add users with default role (team-reader)`,
    `$ kyso organization add-member lo+rey@dev.kyso.io,lo+palpatine@dev.kyso.io darkside`,
    `# Add users with specific role`,
    `$ kyso organization add-member lo+rey@dev.kyso.io,lo+palpatine@dev.kyso.io darkside organization-admin`,
  ];

  static args = [
    {
      name: 'list_of_user_email',
      description: 'Emails of the users to be added to the organization separated by commas.\nExample: lo+rey@dev.kyso.io,lo+palpatine@dev.kyso.io',
      required: true,
    },
    {
      name: 'organization_name',
      description: 'Organization slug name in which the user would be added.\nExample: darkside',
      required: true,
    },
    {
      name: 'role',
      description: '<optional argument> Default is team-reader.\nExample: organization-admin',
      required: false,
      options: ['team-reader', 'team-contributor', 'team-admin', 'organization-admin'],
    },
  ];

  private async addUserToOrganization(api: Api, userEmail: string, organizationSlug: string, role?: string): Promise<void> {
    try {
      const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();

      const organizationObject: NormalizedResponseDTO<Organization> = await api.getOrganizationBySlug(organizationSlug);

      if (!organizationObject || !organizationObject.data) {
        this.error(`Provided organization ${organizationSlug} not found at ${kysoCredentials.kysoInstallUrl}`);
      }

      const usersResponse: NormalizedResponseDTO<UserDTO[]> = await api.getUsers({ userIds: [], page: 1, per_page: 1000, sort: 'email', search: encodeURIComponent(userEmail) });

      if (!usersResponse || !usersResponse.data || usersResponse.data.length === 0) {
        this.error(`Provided user ${userEmail} not found at ${kysoCredentials.kysoInstallUrl}`);
      }

      const newMember: AddUserOrganizationDto = new AddUserOrganizationDto(organizationObject.data.id, usersResponse.data[0].id, role || 'team-reader');

      api.setOrganizationSlug(organizationObject.data.sluglified_name);
      await api.addUserToOrganization(newMember);

      this.log(`\n${usersResponse.data[0].display_name} added to organization ${organizationObject.data.display_name} at ${kysoCredentials.kysoInstallUrl}\n`);
    } catch (e: any) {
      if (!e.response || !e.response.data || !e.response.data.message) {
        this.log(`Error adding ${userEmail} to ${organizationSlug}: ${e.message}`);
      } else {
        this.log(`Error adding ${userEmail} to ${organizationSlug}: ${e.response.data.message}`);
      }
    }
  }

  async run(): Promise<void> {
    const { args } = await this.parse(AddMemberToOrganization);
    const list_of_users: string[] = args.list_of_user_email.split(',');
    const organizationName: string = args.organization_name;
    const desiredRole: string = args.role;

    await launchInteractiveLoginIfNotLogged();
    const kysoCredentials: KysoCredentials = KysoCommand.getCredentials();

    const api: Api = new Api();
    api.configure(`${kysoCredentials.kysoInstallUrl}/api/v1`, kysoCredentials?.token);

    for (const userEmail of list_of_users) {
      try {
        await this.addUserToOrganization(api, userEmail.toLowerCase(), Helper.slug(organizationName), desiredRole);
      } catch (e) {
        this.log(`Error adding user ${userEmail} to org ${organizationName} with role ${desiredRole}`);
        console.log(e);
      }
    }
  }
}

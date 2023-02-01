import { Api } from '@kyso-io/kyso-store';
import { NormalizedResponseDTO, Organization, Team } from '@kyso-io/kyso-model';
import slug from './slugify';
import { KysoCredentials } from '../types/kyso-credentials';

export class Helper {
  public static async getOrganizationFromSlugSecurely(organizationParameter: string, credentials: KysoCredentials): Promise<NormalizedResponseDTO<Organization>> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const slugifiedOrganization = slug(organizationParameter);

    let result: NormalizedResponseDTO<Organization>;
    try {
      const api: Api = new Api();
      api.configure(credentials.kysoInstallUrl + '/api/v1', credentials?.token);
      result = await api.getOrganizationBySlug(slugifiedOrganization);
    } catch (e) {
      console.log(`Can't retrieve organization ${organizationParameter}`);
      if (organizationParameter !== slugifiedOrganization) {
        console.log(`Detected a non-slug value, automatically slugified to ${slugifiedOrganization}`);
      }
      console.log('Please check that the name (or slug) of the organization is correct');
      throw new Error('Please check that the name (or slug) of the organization is correct');
    }

    return result;
  }

  public static async getChannelFromSlugSecurely(organization: Organization, channelParameter: string, credentials: KysoCredentials): Promise<NormalizedResponseDTO<Team>> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const slugifiedChannel = slug(channelParameter);

    let result: NormalizedResponseDTO<Team>;
    try {
      const api: Api = new Api();
      api.configure(credentials.kysoInstallUrl + '/api/v1', credentials?.token, organization.sluglified_name);
      result = await api.getTeamBySlug(organization.id, slugifiedChannel);
    } catch (e) {
      console.log(`Can't retrieve channel ${channelParameter} from organization ${organization.display_name}`);
      if (channelParameter !== slugifiedChannel) {
        console.log(`Detected a non-slug value, automatically slugified to ${slugifiedChannel}`);
      }
      console.log('Please check that the name (or slug) of the channel is correct');
      throw new Error('Please check that the name (or slug) of the channel is correct');
    }

    return result;
  }

  /**
   * Receives an array of organizations (name or slugs, or intercalated)
   *
   * Checks that every organization exists and extracts its slug name
   *
   * Returns an array of checked slug names. If some of these organizations are not valid
   * or don't exists, throws an exception
   *
   * @param list_of_orgs List of orgs (names or slugs) separated by commas
   * @returns Ensured list of slugified names.
   */
  public static async getRealOrganizationSlugFromStringArray(list_of_orgs: string, credentials: KysoCredentials): Promise<string[]> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const organizationList: string[] = list_of_orgs.split(',');
    const organizationSlugs: string[] = [];

    for (const org of organizationList) {
      const secureOrg: NormalizedResponseDTO<Organization> = await Helper.getOrganizationFromSlugSecurely(org, credentials);
      organizationSlugs.push(secureOrg.data.sluglified_name);
    }

    return organizationSlugs;
  }

  /**
   * Receives an array of channels (name or slugs, or intercalated)
   *
   * Checks that every channel exists and extracts its slug name
   *
   * Returns an array of checked slug names. If some of these channels are not valid
   * or don't exists, throws an exception
   *
   * @param organization Organization in which channels must be subscribed
   * @param list_of_channels List of channels (names or slugs) separated by commas
   * @returns Ensured list of slugified names.
   */
  public static async getRealChannelsSlugFromStringArray(organization: Organization, list_of_channels: string, credentials: KysoCredentials): Promise<string[]> {
    // Slug the organization to ensure that if someone introduced the name of the organization in
    // capital letters we are going to be able to answer properly
    const channelsList: string[] = list_of_channels.split(',');
    const channelsSlug: string[] = [];

    for (const channel of channelsList) {
      const secureChannel: NormalizedResponseDTO<Team> = await Helper.getChannelFromSlugSecurely(organization, channel, credentials);
      channelsSlug.push(secureChannel.data.sluglified_name);
    }

    return channelsSlug;
  }
}

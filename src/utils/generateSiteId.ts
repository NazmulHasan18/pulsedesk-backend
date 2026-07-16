import crypto from 'crypto';

/**
 * Generates a short, URL-safe site-id used in the embed snippet:
 * <script src="..." data-site-id="pd_xxxxxxxxxx"></script>
 */
const generateSiteId = (): string => {
  const random = crypto.randomBytes(8).toString('hex');
  return `pd_${random}`;
};

export default generateSiteId;

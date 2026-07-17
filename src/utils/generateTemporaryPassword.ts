import { randomBytes } from 'crypto';

const generateTemporaryPassword = (prefix = 'PD') => {
  return `${prefix}-${randomBytes(9).toString('base64url')}`;
};

export default generateTemporaryPassword;

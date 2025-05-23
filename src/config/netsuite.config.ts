// src/config/netsuite.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('netsuite', () => ({
  baseUrl: process.env.NS_SUITEQL_BASE_URL,
  consumerKey: process.env.NS_CONSUMER_KEY,
  consumerSecret: process.env.NS_CONSUMER_SECRET,
  accessToken: process.env.NS_ACCESS_TOKEN,
  tokenSecret: process.env.NS_TOKEN_SECRET,
  realm: process.env.NS_OAUTH_REALM,
  subsidiaryId: parseInt(process.env.NS_SUBSIDIARY_ID, 10) || 2,
}));
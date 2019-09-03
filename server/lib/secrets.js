const AWS = require('aws-sdk');
const client = new AWS.SecretsManager({ region: 'us-west-2' });

const secretCache = {};
const getSecret = async (secretId, asJson) => {
  if (secretId in secretCache) return Promise.resolve(secretCache[secretId]);

  return new Promise(resolve => {
    client.getSecretValue({ SecretId: secretId }, (err, data) => {
      if (err) {
        resolve.reject(err);
      } else if ('SecretString' in data) {
        let secret = data.SecretString;
        if (asJson) secret = JSON.parse(secret);

        secretCache[secretId] = secret;
        resolve(secret);
      }
    });
  });
};

const resolveSecret = async value => {
  if (typeof value === 'string' && value.startsWith('aws:')) {
    let parts = value.split(':');
    switch (parts.length) {
      case 2: {
        let secret = await getSecret(parts[1], false);
        return secret;
      }
      case 3: {
        let secret = await getSecret(parts[1], true);
        return secret[parts[2]];
      }
      default:
        Promise.reject(`Invalid secret reference ${value}`);
    }
  }
  return Promise.resolve(value);
};

const resolveSecrets = async obj => {
  let result = {};
  const asyncResult = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => {
      return new Promise(async (resolve, reject) => {
        resolve([key, await resolveSecret(value)]);
      });
    })
  );
  return asyncResult.reduce((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
};

module.exports = {
  resolveSecret,
  resolveSecrets
};

#!/usr/bin/env python3
import argparse
import os
from base64 import b64encode

import requests

parser = argparse.ArgumentParser()

parser.add_argument(
    '-o',
    '--output',
    help='File to write to',
    dest='output',
    required=True
)
parser.add_argument(
    '-s',
    '--secret',
    help='Secret name to get',
    dest='secret',
    required=True
)

args = parser.parse_args()

VAULT_ADDR = os.getenv('VAULT_ADDR')
APPROLE_PAYLOAD = {
    "role_id": os.getenv('VAULT_ROLE_ID'),
    "secret_id": os.getenv('VAULT_SECRET_ID'),
}
LOGIN_URL = "{0}v1/auth/approle/login".format(VAULT_ADDR)
vault_token = requests.post(LOGIN_URL, data=APPROLE_PAYLOAD).json()['auth']['client_token']
versions = requests.get("{0}v1/kv/metadata/{1}".format(VAULT_ADDR, args.secret), headers={"X-Vault-Token": vault_token}).json()['data']['versions']
latest_available = max([int(k) for k, v in versions.items() if v['destroyed'] == False])

print("Fetching {0} version {1}".format(args.secret, latest_available))
SECRETS_URL = "{0}v1/kv/data/{1}?version={2}".format(VAULT_ADDR, args.secret, latest_available)

secrets = requests.get(SECRETS_URL, headers={"X-Vault-Token": vault_token}).json()['data']['data']

temp = ""
for secret in secrets:
    temp += """
    - name: {0}
      value: "{1}" """.format(secret, secrets[secret])

output = """apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsUser: 1000
    runAsGroup: 1000
  containers:
  - args:
    - infinity
    command:
    - sleep
    env:
    {0}
    image: registry.digitalocean.com/bonq-ch/deployer:latest
    imagePullPolicy: Always
    name: deployer
""".format(temp)

with open(args.output, 'w+') as fh:
    fh.write(output)

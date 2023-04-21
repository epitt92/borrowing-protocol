#!/usr/bin/env python3
import argparse
import hashlib
import pathlib

parser = argparse.ArgumentParser(
    description='Render k8s templates'
)

parser.add_argument(
    '-e',
    '--envs-path',
    help='Path to envs if it is needed to generate and set MD5 hash',
    dest='envs'
)
parser.add_argument(
    '-i',
    '--image',
    help='Docker image to use. No default',
    dest='image'
)
parser.add_argument(
    '-t',
    '--template',
    help='Template to use. Default: deployment',
    default='deployment',
    dest='template'
)

args = parser.parse_args()

template = open(args.template).read()

if args.envs is None:
    print(template.format(args))
else:
    print(template.format(
        args,
        env_hash = hashlib.md5(pathlib.Path(args.envs).read_bytes()).hexdigest()
    ))


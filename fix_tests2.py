import os
import re

directory = 'backend'
files = [
    'test_e2e_phase3.js',
    'test_e2e_phase4.js',
    'test_kill_ml_resilience.js',
    'test_mqtt.js',
    'test_multinode_lora.mjs',
    'sniff_lora.mjs'
]

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace `import 'dotenv/config';` with proper config
    if 'import \'dotenv/config\';' in content:
        content = content.replace("import 'dotenv/config';", "import dotenv from 'dotenv';\ndotenv.config({ path: '../.env' });")
    
    # Just in case `require('dotenv').config();` is there
    content = content.replace("require('dotenv').config();", "import dotenv from 'dotenv';\ndotenv.config({ path: '../.env' });")

    with open(filepath, 'w') as f:
        f.write(content)

for filename in files:
    fix_file(os.path.join(directory, filename))

#!/bin/bash
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi
exec /usr/local/bin/npx --yes vercel@latest --prod --yes

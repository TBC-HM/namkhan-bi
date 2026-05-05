#!/bin/bash
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi
npx vercel --prod --yes --force 2>&1

#!/bin/bash
export PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH
cd /Users/paulbauer/Desktop/namkhan-bi
npx next build 2>&1 | tail -40

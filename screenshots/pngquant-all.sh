#!/bin/bash

find . -name '*.png' -print0 | xargs -0 -P8 -L1 pngquant --ext .png --force 256
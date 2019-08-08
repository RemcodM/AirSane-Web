# AirSane Web

This repository contains a web front-end for the AirSane project at 
https://github.com/RemcodM/AirSane, originally forked from
https://github.com/SimulPiscator/AirSane, but with changes to support
newer ESCL apps and this web front-end.

This front-end communicates with the AirSane back-end directly over HTTP.
Nor authentication or secure communication is supported, as this is also
not supported by the AirSane project itself.

If you are looking for a powerful SANE web frontend, AirSane Web may not be for you.
You may be interested in [phpSANE](https://sourceforge.net/projects/phpsane) instead.

## Usage

To simply start testing the front-end, ensure you have a recent version of 
[Node](https://nodejs.org/en/download/) and npm installed. Then clone this repository
and in the project folder run:

`npm start`

This will start the Webpack development server and launch the AirSane Web front-end in
your browser.

## Building

To build AirSane Web, run `npm run build` from the project directory. This will build
the AirSane Web front-end to the `dist` directory. The contents of this directory
are just plain HTML/CSS/JS, such that they can be served by any web server.

### Docker image
Alternatively, you can build a minimal NGINX image serving the application by using
the included Dockerfile. Ensure you are on a Docker enabled machine and run 
`docker build .`. Obviously, the Dockerfile can also be used in other Docker-compatible
environments, as long as multi-staged builds are supported.

## Configuration of hosts

By default, the AirSane Web front-end expects an AirSane server to run on 
`localhost:8090`. However, this may not be the case in your environment. In order
to change this, add or replace the host given in `src/hosts.json` before compilation.

Please note that multiple hosts can be added to `src/hosts.json`. AirSane Web will
show devices of all hosts in this file, so if you have multiple AirSane hosts, you
can use all of them from one interface.
# Getting Started

First, clone this repo. This is the master repo that holds all of the microservices. To do this issue this command:

```git clone --recursive git@github.com:jjcm/soci.git```

Next you'll want to update the repos:

```git submodule update --recursive --remote```

Next you'll want to set up your DB. Ensure that you have mysql or mariadb running, with connection details filled into the `localrun.sh` files or `config.json` files that are in each of the repos. 

After that, you'll want to start the servers:

```./quickstart.sh```

This will open a GNU Screen session with each microservice running in a different screen window. To switch between screen windows use this key sequence:

```ctrl+a -> n```

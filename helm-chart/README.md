# Bot-Charts

## Initial setup

1. Copy the login command from the oc web interface

1. Setup tiller for openshift according to https://blog.openshift.com/getting-started-helm-openshift/

1. Export tiller namespace. This value is derived from your project name in OpenShift

    ```bash
    export TILLER_NAMESPACE=lunchbot
    ```

1. Switch to the right project

    ```bash
    oc project "${TILLER_NAMESPACE}"
    ```

1. Install chart dependencies

    ```
    helm dependencies build .
    ```

1. Install helm secrets (also installs sops for you)

    ```bash
    helm plugin install https://github.com/futuresimple/helm-secrets
    ```

1. Import the GPG key with password (key checked in into the repository, password in encrypted mail)

    ```bash
    gpg --import bot-key.asc
    ```

1. Decrypt the secrets file in the repository

    ```
    export GPG_TTY=$(tty)
    sops -d values-secret-enc.yaml > values-secret.yaml
    ```

1. Install the chart

    ```bash
    helm install -f values-secret.yaml --name lunchbot .
    ```

1. Upgrade the chart

    ```bash
    helm upgrade --force -i -f values-secret.yaml lunchbot .
    ```

## Encrypt secrets

1.  Generate gpg key and follow the instructions of the GPG command

     ```
     gpg --full-generate-key
     ```

    Or import the private key and insert the GPG key secret, when asked

     ```bash
     gpg --import lunchbot-key.asc
     ```

1.  Get your GPG key name

     ```
     gpg --list-keys | grep -B 1 "<your-name>" | head -n 1
     ```

1. Encrypt the prod values with your GPG key, using the name as `-p` parameter (e.g. A4878FB56D42C57D6844B89228304EAF0C83A69D)

    ```bash
    sops -e -p A4878FB56D42C57D6844B89228304EAF0C83A69D values-secret.yaml > values-secret-enc.yaml
    ```

## Export GPG key

```bash
gpg -a --export-secret-key "${ID}" > lunchbot-key.asc
```

## Delete project

To delete the whole helm chart in your OpenShift project, just run

```bash
export TILLER_NAMESPACE=lunchbot
helm del --purge lunchbot
```

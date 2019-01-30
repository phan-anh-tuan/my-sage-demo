FROM jenkins/jenkins:lts
# if we want to install via apt
USER root
RUN apt-get update && apt-get install python3-pip -y && pip3 install awscli --upgrade && aws --version
#ARG ACCESS_KEY_ID=ACCESS_KEY_ID
#ARG SECRET_ACCESS_KEY=SECRET_ACCESS_KEY
#ARG DEFAULT_REGION=DEFAULT_REGION
#ENV AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID
#ENV AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY
#ENV AWS_DEFAULT_REGION=$DEFAULT_REGION
# drop back to the regular jenkins user - good practice
USER jenkins

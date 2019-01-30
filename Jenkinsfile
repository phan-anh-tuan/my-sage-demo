pipeline {
    agent any 
    environment {
        AWS_ACCESS_KEY_ID     = credentials('jenkins-aws-secret-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('jenkins-aws-secret-access-key')
    }
    stages {
        stage('Preparation') {
            steps {
                sh label: '', returnStatus: true, script: 'sudo apt install python3-pip -y && sudo pip install --upgrade pip && sudo pip3 install awscli --upgrade && aws --version     '
            }
        }
       
        stage('Build') {
            steps {
                echo "Running ${env.BUILD_ID} on ${env.JENKINS_URL}"
                echo "aws_access_key_id: $AWS_ACCESS_KEY_ID"
                checkout scm
                echo 'Finished checking out the source code!' 
                archiveArtifacts artifacts: '**/README.md', fingerprint: true 
            }
        }
        
        stage('Test') {
            steps {
                echo 'unit test should be triggered here!' 
            }
        }
        
        stage('Provision CI environment') {
            steps {
                sh label: '', returnStatus: true, script: 'aws cloudformation create-stack --template-body file://singleInstance.yml --stack-name single-instance --parameters ParameterKey=KeyName,ParameterValue=tuan.phan-key-pair-sydney'    
                echo 'CI environment provisioned!'
            }
        }
        
        stage('Staging') {
            when {
              expression {
                currentBuild.result == null || currentBuild.result == 'SUCCESS' 
              }
            }
            steps {
                echo 'Ready to push to Staging'
            }
        }
    }
}

pipeline {
    agent any 
    environment {
        AWS_ACCESS_KEY_ID     = credentials('jenkins-aws-secret-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('jenkins-aws-secret-access-key')
        AWS_DEFAULT_REGION = credentials('jenkins-aws-default-region')
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
                //sh label: '', returnStatus: true, script: 'printenv'
                checkout scm
                echo 'Finished checking out the source code!' 
                archiveArtifacts artifacts: '**/README.md', fingerprint: true 
            }
        }
        
        stage('Test') {
            steps {
                echo 'unit test should be triggered here!' 
                withCredentials([sshUserPrivateKey(credentialsId: 'tuanphan-key-pair-sydney.pem', keyFileVariable: 'PATH_TO_KEY_FILE', passphraseVariable: '', usernameVariable: '')]) {
                    sh label: '', returnStatus: true, script: 'printenv'
                }
            }
        }
        
        stage('Provision CI environment') {
            steps {
                sh label: '', returnStatus: true, script: 'aws cloudformation create-stack --template-body file://singleInstance.yml --stack-name single-instance --parameters ParameterKey=KeyName,ParameterValue=tuan.phan-key-pair-sydney'    
                script {
                    /*def STACK_STATUS="CREATE_IN_PROGRESS"
                    while [ "$STACK_STATUS" != "CREATE_COMPLETE" ]
                    do
                      sleep 5s
                      break;
                      STACK_STATUS = sh(label: '', returnStdout: true, script: 'aws cloudformation describe-stacks --stack-name single-instance |  python -c "import sys, json; print json.load(sys.stdin)[\'Stacks\'][0][\'StackStatus\']"')
                      echo "STATUS: $STACK_STATUS"
                    done*/
                    wait_for_ci_environment()
                }
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

@NonCPS
def wait_for_ci_environment() {
    def n=1
    while (( n <= 5 )) {
        echo "Welcome $n times."
        n=n+1
    }
}

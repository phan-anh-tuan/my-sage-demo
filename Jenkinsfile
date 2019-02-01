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
        
        stage('Unit Test') {
            steps {
                echo 'unit test should be triggered here!' 
            }
        }
        
        stage('Provision CI environment') {
            steps {
                //sh label: '', returnStatus: true, script: 'aws cloudformation create-stack --template-body file://singleInstance.yml --stack-name single-instance --parameters ParameterKey=KeyName,ParameterValue=tuan.phan-key-pair-sydney'    
                script {
                    //STACK_STATUS="CREATE_IN_PROGRESS"
                    STACK_STATUS="CREATE_COMPLETE"
                    while (!STACK_STATUS.trim().equalsIgnoreCase("CREATE_COMPLETE")) {
                      sleep 60
                      STACK_STATUS = sh(label: '', returnStdout: true, script: 'aws cloudformation describe-stacks --stack-name single-instance |  python -c "import sys, json; print json.load(sys.stdin)[\'Stacks\'][0][\'StackStatus\']"')
                    }
                }
                echo 'CI environment provisioned!'
            }
        }

        stage('Deploy application to CI environment') {
            steps {
                script {
                    PUBLIC_IP = sh label: '', returnStdout: true, script: '''aws cloudformation describe-stacks --stack-name single-instance |  python -c "import sys, json; outputs = json.load(sys.stdin)[\'Stacks\'][0][\'Outputs\']
for output in outputs:
 if output[\'OutputKey\'] == \'PublicIP\':
  print output[\'OutputValue\']"
'''
                    PUBLIC_IP = PUBLIC_IP.trim()
                    //returnVal = sh label: '', returnStatus: true, script: "export IPADDR=$PUBLIC_IP"
                    //println returnVal
                    withCredentials([sshUserPrivateKey(credentialsId: 'tuanphan-key-pair-sydney.pem', keyFileVariable: 'PATH_TO_KEY_FILE', passphraseVariable: '', usernameVariable: '')]) {
                        sh label: '', returnStatus: true, script: 'cat $PATH_TO_KEY_FILE'
                        sh label: '', returnStatus: true, script: "rsync -avz -e \"ssh -i $PATH_TO_KEY_FILE\" README.md ubuntu@$PUBLIC_IP:/var/www/html"
                    }
                }
            }
        }
        
        stage('Integration Test') {
            steps {
                echo 'Katalon test should be triggered here!' 
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

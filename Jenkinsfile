pipeline {
    agent { label 'master' }
    environment {
        AWS_ACCESS_KEY_ID     = credentials('jenkins-aws-secret-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('jenkins-aws-secret-access-key')
        AWS_DEFAULT_REGION = credentials('jenkins-aws-default-region')
    }
    stages {
        //stage('Preparation') {
        //    steps {
        //        sh label: '', script: 'sudo apt install python-pip -y &&  sudo pip install awscli --upgrade && aws --version'
        //    }
        //}
       
        stage('Build') {
            steps {
                echo "Running ${env.BUILD_ID} on ${env.JENKINS_URL}"
                checkout scm
                echo 'Finished checking out the source code!' 
                // archiveArtifacts artifacts: '**/README.md', fingerprint: true 
                emailext attachLog: false, body: '''$PROJECT_NAME - Build # $BUILD_NUMBER - $BUILD_STATUS:
                 ${ENV,var="GIT_BRANCH"} ${ENV,var="GIT_COMMIT"}''', compressLog: true, replyTo: 'phan.anh.tuan@gmail.com', subject: '$PROJECT_NAME - Build # $BUILD_NUMBER - $BUILD_STATUS!', to: "tuan.phan@informed.com"
                error 'pipeline stopped here'
            }
        }
        
        stage('Unit Test') {
            steps {
                sh label: '', script: 'printenv'
                echo 'unit test should be triggered here!' 
            }
        }
        
        stage('Provision CI environment') {
            steps {
                // sh label: '', returnStatus: true, script: 'aws cloudformation create-stack --template-body file://singleInstance.yml --stack-name single-instance --parameters ParameterKey=KeyName,ParameterValue=tuan.phan-key-pair-sydney'    
                script {
                    // STACK_STATUS="CREATE_IN_PROGRESS"
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
                pwd()
                sh label: '', script: 'ls -la'
                script {
                    PUBLIC_IP = sh label: '', returnStdout: true, script: '''aws cloudformation describe-stacks --stack-name single-instance |  python -c "import sys, json; outputs = json.load(sys.stdin)[\'Stacks\'][0][\'Outputs\']
for output in outputs:
 if output[\'OutputKey\'] == \'PublicIP\':
  print output[\'OutputValue\']"
'''
                    PUBLIC_IP = PUBLIC_IP.trim()
                    sh label: '', returnStdout: true, script: "sed -i 's/IP/$PUBLIC_IP/g' Profiles/default.glbl"
                    sshagent(['tuanphan-key-pair-sydney.pem']) {
                        //sh 'ssh -o StrictHostKeyChecking=no -l ubuntu 13.236.152.149 uname -a'
                        returnVal = sh label: '', returnStatus: true, script: "rsync -avz -e 'ssh -o StrictHostKeyChecking=no' --delete-after --delete-excluded --exclude '.git' . ubuntu@$PUBLIC_IP:/var/www/html"
                        println returnVal
                    }
                }
            }
        }
        
        stage('Integration Test') {
            steps {
                script {
                    withDockerContainer(args: '-u root', image: 'katalonstudio/katalon') {
                        RET_VAL = sh label: '', returnStatus: true, script: 'katalon-execute.sh -browserType="Chrome" -retry=0 -statusDelay=15 -testSuitePath="Test Suites/RegressionTest"'
                        echo "Katalon test return $RET_VAL"
                    }   
                }
            }
            //agent {
            //    docker {
            //        image 'katalonstudio/katalon'
            //        args "-u root"
            //    }
           // }
            post {
                always {
                    archiveArtifacts artifacts: 'report/**/*.*', fingerprint: true
                    // junit 'report/**/JUnit_Report.xml'
                    junit allowEmptyResults: true, healthScaleFactor: 5.0, testResults: 'report/**/JUnit_Report.xml'
                    echo "Build result $currentBuild.result"
                }
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

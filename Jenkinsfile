pipeline {
    agent any 
    environment {
        AWS_ACCESS_KEY_ID     = credentials('jenkins-aws-secret-key-id')
        AWS_SECRET_ACCESS_KEY = credentials('jenkins-aws-secret-access-key')
    }
    stages {
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

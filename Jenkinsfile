pipeline {
    agent any 
    stages {
        stage('Build') {
            steps {
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

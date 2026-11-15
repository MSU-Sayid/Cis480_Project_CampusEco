<?php
// Set environment variables for your local MariaDB installation; do not commit secrets.
return [
 'host'=>getenv('DB_HOST') ?: '127.0.0.1',
 'port'=>getenv('DB_PORT') ?: '3306',
 'database'=>getenv('DB_NAME') ?: 'campuseco',
 'username'=>getenv('DB_USER') ?: 'campuseco',
'password' => getenv('DB_PASSWORD') ?: 'cis483#team',
];

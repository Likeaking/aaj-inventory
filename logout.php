<?php
// logout.php - ends the session and returns to the login page.
session_start();
session_destroy();
header('Location: index.php');

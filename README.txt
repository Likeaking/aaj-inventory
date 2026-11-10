AAJ's Inventory Management System - XAMPP setup
1. Copy the folder "aaj" into C:\xampp\htdocs\
2. Start Apache and MySQL in the XAMPP Control Panel.
3. Open http://localhost/phpmyadmin -> Import -> choose database.sql -> Go.
4. Open http://localhost/aaj/
Logins:  admin / admin123 (Shop Owner)   |   staff / staff123 (Staff)
If your MySQL root has a password, edit config.php.

Accounts / roles:
- Sign up at register.php and click "Staff" or "Admin" (only ONE Admin account can exist).
- Admin: manages products (add, edit, archive, restore, delete), records stock-in and sales,
         monitors stock and low-stock alerts, and views the Reports Dashboard.
- Staff: records stock-in and sales, searches and sorts the inventory, and undoes the latest entry.
- Demo logins: admin / admin123 (Admin)  |  staff / staff123 (Staff)

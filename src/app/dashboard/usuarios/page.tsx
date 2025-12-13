"use client";

import UserManagement from '@/src/components/users/UserManagement';
import withAuth from '@/components/withAuth';

function UsersPage() {
    return <UserManagement />;
}

export default withAuth(UsersPage);

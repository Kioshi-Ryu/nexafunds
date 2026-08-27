import React from "react";

type AvatarUser = {
  name: string;
  profileImageUrl?: string | null;
};

export function UserAvatar({ user, className = "avatar" }: { user: AvatarUser; className?: string }) {
  if (user.profileImageUrl) {
    return <img className={`${className} avatar-image`} src={user.profileImageUrl} alt={`${user.name}'s profile`} />;
  }
  return <div className={className}>{user.name?.[0]?.toUpperCase() || "U"}</div>;
}

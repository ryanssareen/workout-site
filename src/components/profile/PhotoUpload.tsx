'use client';

import { useRef, useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getStorageInstance } from '@/lib/firebase/config';
import { getDbInstance } from '@/lib/firebase/config';
import { useAuthStore } from '@/lib/stores/authStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { User } from '@/types';

interface PhotoUploadProps {
  user: User;
  size?: number;
  className?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function PhotoUpload({ user, size = 116, className }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const setUser = useAuthStore((s) => s.setUser);

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, WebP, or GIF image');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Image must be under 5MB');
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);

    try {
      // Upload to Firebase Storage
      const storage = getStorageInstance();
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `profilePhotos/${user.username}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file, {
        contentType: file.type,
      });

      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore
      await updateDoc(doc(getDbInstance(), 'users', user.username), {
        photoURL: downloadURL,
        updatedAt: serverTimestamp(),
      });

      // Update Zustand store
      setUser({ ...user, photoURL: downloadURL });
      setPreviewUrl(null); // Use the real URL now
      toast.success('Profile photo updated!');
    } catch (error: any) {
      console.error('Photo upload failed:', error);
      setPreviewUrl(null);
      toast.error(error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localPreview);
    }
  };

  const displayUrl = previewUrl || user.photoURL;

  return (
    <div className={cn('relative group', className)}>
      <button
        onClick={handleClick}
        disabled={uploading}
        className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all"
        aria-label="Upload profile photo"
      >
        <Avatar
          className="border-4 border-background shadow-xl"
          style={{ width: size, height: size }}
        >
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt={user.displayName} />
          ) : null}
          <AvatarFallback
            className="text-3xl font-bold bg-gradient-to-br from-red-500/20 to-red-800/20 text-red-500"
            style={{ fontSize: size * 0.26 }}
          >
            {user.displayName ? getInitials(user.displayName) : '?'}
          </AvatarFallback>
        </Avatar>

        {/* Camera overlay */}
        <div
          className={cn(
            'absolute inset-0 rounded-full flex items-center justify-center transition-all',
            uploading
              ? 'bg-black/50'
              : 'bg-black/0 group-hover:bg-black/40',
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

import { PostForm } from '@/components/post-form';

export const revalidate = 0;

export default function NewPostPage() {
  return (
    <div style={{ padding: '40px 0', maxWidth: 720 }}>
      <div className="label">Admin</div>
      <h2>New Post</h2>
      <PostForm post={null} />
    </div>
  );
}

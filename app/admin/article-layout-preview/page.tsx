import {AdminArticleLayoutPreview} from "@/components/admin/AdminArticleLayoutPreview";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function ArticleLayoutPreview({searchParams}:{searchParams:Promise<{article?:string}>}){
  const {article=""}=await searchParams;
  // Only public navigation is server-rendered. Draft content is fetched through the existing authenticated API.
  return <AdminArticleLayoutPreview articleId={article}/>;
}

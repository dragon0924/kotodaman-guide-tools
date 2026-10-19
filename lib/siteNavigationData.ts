import {readArticles} from "./articleStore";
import {getCharacterCache} from "./characterStore";
import {readSiteNavigation} from "./siteNavigationStore";
import {buildPublicSiteNavigation} from "./siteNavigation";

export async function getPublicSiteNavigation(){
  const [snapshot,articles,all]=await Promise.all([readSiteNavigation(),readArticles(),getCharacterCache()]);
  return buildPublicSiteNavigation(snapshot.settings,all.characters,articles.articles);
}

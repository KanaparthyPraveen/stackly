import { Clock, Code2, Trophy, Target, Music } from "lucide-react";
import { GithubIcon, DiscordIcon } from "@/components/stackly/icons";

/**
 * Presentation details for each provider the backend supports.
 *
 * This is display copy only. Which providers exist, whether they are
 * configured and whether the user has connected them all come from the API.
 */
export type IntegrationPresentation = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
};

export const INTEGRATION_CATALOG: IntegrationPresentation[] = [
  {
    id: "github",
    name: "GitHub",
    description:
      "Show your public repositories, followers and top languages, with a verified handle on your profile.",
    icon: <GithubIcon className="h-4 w-4" />,
  },
  {
    id: "discord",
    name: "Discord",
    description:
      "Link a verified Discord username so visitors know it is really you.",
    icon: <DiscordIcon className="h-4 w-4" />,
  },
  {
    id: "spotify",
    name: "Spotify",
    description: "Show what you are listening to and your top tracks.",
    icon: <Music className="h-4 w-4" />,
  },
  {
    id: "wakatime",
    name: "WakaTime",
    description:
      "Show your coding time, languages and editors from the last 7 days. Connects with your WakaTime API key.",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: "leetcode",
    name: "LeetCode",
    description:
      "Link your public LeetCode profile. Self-declared: LeetCode offers no official API for verified stats.",
    icon: <Code2 className="h-4 w-4" />,
  },
  {
    id: "codechef",
    name: "CodeChef",
    description:
      "Link your public CodeChef profile. Self-declared: CodeChef offers no official API for verified stats.",
    icon: <Trophy className="h-4 w-4" />,
  },
  {
    id: "hackerrank",
    name: "HackerRank",
    description:
      "Link your public HackerRank profile. Self-declared: HackerRank offers no official API for verified stats.",
    icon: <Target className="h-4 w-4" />,
  },
];

package ug.trinityfamilyschool.photo;

import java.net.URI;

final class NativePushPolicy {
    static boolean accountMatches(String account, String project, String recipient, String incomingProject) {
        return account!=null&&!account.isEmpty()&&account.equals(recipient)&&project.equals(incomingProject);
    }
    static String route(String input) {
        try {
            if(input==null||input.length()>2048||!input.startsWith("/")||input.startsWith("//")||input.contains("\\")||input.contains("\n")||input.contains("\r")) return PhotoPolicy.ORIGIN+"/push-notifications";
            URI uri=URI.create(PhotoPolicy.ORIGIN).resolve(input);
            return PhotoPolicy.trusted(uri.toString()) ? uri.toString() : PhotoPolicy.ORIGIN+"/push-notifications";
        } catch(Exception ignored){return PhotoPolicy.ORIGIN+"/push-notifications";}
    }
}

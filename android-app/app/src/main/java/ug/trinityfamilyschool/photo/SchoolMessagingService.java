package ug.trinityfamilyschool.photo;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

public final class SchoolMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) { NativePush.tokenChanged(this,token); }
    @Override public void onMessageReceived(RemoteMessage message) { NativePush.receive(this,message.getData()); }
}

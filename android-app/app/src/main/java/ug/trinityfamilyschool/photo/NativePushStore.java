package ug.trinityfamilyschool.photo;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Device registration proofs are private, encrypted, excluded from backup, and never returned to JavaScript. */
final class NativePushStore {
    private final AtomicFile file;
    NativePushStore(Context context) { file = new AtomicFile(new File(context.getNoBackupFilesDir(), "native-push-v1.enc")); }
    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if(store.containsAlias("trinity-native-push-v1")) return (SecretKey)store.getKey("trinity-native-push-v1",null);
        KeyGenerator generator=KeyGenerator.getInstance("AES","AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder("trinity-native-push-v1",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build()); return generator.generateKey();
    }
    JSONObject read() throws Exception {
        if(!file.getBaseFile().exists()) return fresh();
        byte[] bytes=file.readFully(); if(bytes.length<29||bytes.length>65536) throw new IllegalStateException("Invalid push registration");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(bytes,0,12)));
        return new JSONObject(new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.UTF_8));
    }
    void write(JSONObject state) throws Exception {
        byte[] plain=state.toString().getBytes(StandardCharsets.UTF_8); if(plain.length>65000) throw new IllegalStateException("Push registration too large");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key());
        FileOutputStream stream=null; try {stream=file.startWrite();stream.write(cipher.getIV());stream.write(cipher.doFinal(plain));file.finishWrite(stream);}
        catch(Exception error){if(stream!=null)file.failWrite(stream);throw error;}
    }
    static JSONObject fresh() throws Exception {
        byte[] secret=new byte[32];new SecureRandom().nextBytes(secret);
        return new JSONObject().put("installationId",UUID.randomUUID().toString())
            .put("deviceSecret",android.util.Base64.encodeToString(secret,android.util.Base64.URL_SAFE|android.util.Base64.NO_WRAP|android.util.Base64.NO_PADDING)).put("enabled",true);
    }
}

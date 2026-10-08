package ug.trinityfamilyschool.photo;

import org.junit.Test;
import static org.junit.Assert.*;

public class PhotoPolicyTest {
    @Test public void onlySchoolHttpsOriginGetsBridgePrivileges() {
        assertTrue(PhotoPolicy.trusted(PhotoPolicy.ORIGIN + "/pupils/new"));
        assertTrue(PhotoPolicy.trusted(PhotoPolicy.ORIGIN + ":443/pupils"));
        assertFalse(PhotoPolicy.trusted(PhotoPolicy.ORIGIN.replace("https:", "http:")));
        assertFalse(PhotoPolicy.trusted(PhotoPolicy.ORIGIN + ".evil.test"));
        assertFalse(PhotoPolicy.trusted(PhotoPolicy.ORIGIN + "@evil.test"));
        assertFalse(PhotoPolicy.trusted("https://another-school.example"));
        assertFalse(PhotoPolicy.trusted(PhotoPolicy.ORIGIN + ":444"));
        assertFalse(PhotoPolicy.trusted("file:///photos/photo.jpg"));
    }
    @Test public void neverAcceptThumbnailOrOversizedCapture() {
        assertTrue(PhotoPolicy.fullSizeJpeg(5_000_000, 4000, 3000));
        assertFalse(PhotoPolicy.fullSizeJpeg(20_000, 320, 240));
        assertFalse(PhotoPolicy.fullSizeJpeg(0, 4000, 3000));
        assertFalse(PhotoPolicy.fullSizeJpeg(PhotoPolicy.MAX_BYTES + 1, 4000, 3000));
        assertFalse(PhotoPolicy.fullSizeJpeg(100, -1, -1));
    }
    @Test public void opaqueIdsOnly() {
        assertTrue(PhotoPolicy.validId("10fd9272-f097-4b03-9b12-6048e72d3d7a"));
        assertFalse(PhotoPolicy.validId("../../private"));
        assertFalse(PhotoPolicy.validId(null));
    }
}

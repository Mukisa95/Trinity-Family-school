package ug.trinityfamilyschool.photo;
import org.junit.Test;
import java.util.*;
import static org.junit.Assert.*;

public class DocumentPolicyTest {
    @Test public void filenamesCannotEscapeTheSelectedFolderAndKeepTheirExtension() {
        String name=DocumentPolicy.fileName("../../P.4: report.PDF");
        assertFalse(name.contains("/"));assertFalse(name.contains("\\"));assertFalse(name.startsWith("."));assertTrue(name.endsWith(".pdf"));
        assertEquals("Pupil résumé.pdf",DocumentPolicy.fileName("Pupil résumé.pdf"));
        assertEquals("document.pdf",DocumentPolicy.fileName(""));
        String longName=DocumentPolicy.fileName("😀".repeat(150)+".pdf");
        assertEquals(104,longName.codePointCount(0,longName.length()));assertFalse(Character.isHighSurrogate(longName.charAt(longName.length()-5)));
    }
    @Test public void sameNamesProduceNewFilesWithoutOverwritingExistingExports() {
        assertEquals("report (3).pdf",DocumentPolicy.uniqueName("report.pdf",Set.of("report.pdf","report (2).pdf")));
        assertEquals("report.pdf",DocumentPolicy.uniqueName("report.pdf",Collections.emptySet()));
    }
    @Test public void commonSchoolDocumentsHaveNativeMimeTypes() {
        assertEquals("application/pdf",DocumentPolicy.mime("report.PDF"));
        assertEquals("image/png",DocumentPolicy.mime("page.png"));
        assertTrue(DocumentPolicy.mime("register.xlsx").contains("spreadsheetml"));
        assertTrue(DocumentPolicy.mime("letter.docx").contains("wordprocessingml"));
        assertEquals("text/csv",DocumentPolicy.mime("pupils.csv"));
    }
    @Test(expected=IllegalArgumentException.class) public void apkDownloadsDoNotEnterTheDocumentBridge(){DocumentPolicy.fileName("app.apk");}
    @Test(expected=IllegalArgumentException.class) public void emptyTransfersCannotBeReportedAsSaved(){DocumentPolicy.size(0);}
    @Test(expected=IllegalArgumentException.class) public void oversizedDocumentsAreRejected(){DocumentPolicy.size(DocumentPolicy.MAX_BYTES+1);}
    @Test public void transferAllowsOnlyTheNextBoundedChunkAndExactRemainingSize(){DocumentPolicy.chunk(2,2,100,40,140);}
    @Test(expected=IllegalArgumentException.class) public void missingOrDuplicateChunksCannotCorruptAnExport(){DocumentPolicy.chunk(2,1,100,40,140);}
    @Test(expected=IllegalArgumentException.class) public void chunksCannotExceedDeclaredDocumentSize(){DocumentPolicy.chunk(2,2,100,41,140);}
    @Test(expected=IllegalArgumentException.class) public void oversizedMessagesCannotExhaustTheBridge(){DocumentPolicy.chunk(0,0,0,DocumentPolicy.CHUNK_BYTES+1,DocumentPolicy.MAX_BYTES);}
}

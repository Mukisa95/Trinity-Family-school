package ug.trinityfamilyschool.photo;

import org.junit.Test;
import static org.junit.Assert.*;

public class PageLoadStateTest {
    private static final String HOME = "https://school.example/";

    @Test public void genuineFailedDocumentRemainsPending() {
        PageLoadState state = new PageLoadState();
        state.begin(HOME);
        assertTrue(state.fail(HOME));
        assertTrue(state.pending(state.revision()));
    }

    @Test public void mountedDocumentCancelsErrorIncludingLateFailure() {
        PageLoadState state = new PageLoadState();
        state.begin(HOME);
        state.recovered(state.revision());
        assertTrue(state.fail(HOME));
        state.recovered(state.revision());
        assertFalse(state.pending(state.revision()));
    }

    @Test public void nextDocumentCanStillFailAfterSuccessfulRecovery() {
        PageLoadState state = new PageLoadState();
        state.begin(HOME);
        state.recovered(state.revision());
        state.begin(HOME + "pupils");
        assertTrue(state.fail(HOME + "pupils"));
        assertTrue(state.pending(state.revision()));
    }

    @Test public void previousNavigationFailureIsIgnored() {
        PageLoadState state = new PageLoadState();
        state.begin(HOME);
        state.begin(HOME + "pupils");
        assertFalse(state.fail(HOME));
        assertFalse(state.pending(state.revision()));
    }

    @Test public void previousProbeCannotShowOrClearNewDocumentError() {
        PageLoadState state = new PageLoadState();
        state.begin(HOME);
        state.fail(HOME);
        long oldProbe = state.revision();
        state.begin(HOME + "pupils");
        state.fail(HOME + "pupils");
        assertFalse(state.current(oldProbe));
        assertFalse(state.pending(oldProbe));
        state.recovered(oldProbe);
        assertTrue(state.pending(state.revision()));
    }

    @Test public void fragmentsIdentifySameDocumentButQueriesDoNot() {
        PageLoadState state = new PageLoadState();
        state.begin(HOME + "pupil-detail?id=one#details");
        assertTrue(state.fail(HOME + "pupil-detail?id=one"));
        assertFalse(state.fail(HOME + "pupil-detail?id=two"));
    }
}

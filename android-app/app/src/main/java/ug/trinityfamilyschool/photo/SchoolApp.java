package ug.trinityfamilyschool.photo;

/** The school build owns its name, website and Android storage identity. */
final class SchoolApp {
    static final String NAME = BuildConfig.SCHOOL_APP_NAME;
    private static android.graphics.Bitmap logo;
    static synchronized android.graphics.Bitmap notificationLogo(android.content.Context context) {
        if (logo == null) {
            android.graphics.BitmapFactory.Options options = new android.graphics.BitmapFactory.Options(); options.inSampleSize = 4;
            logo = android.graphics.BitmapFactory.decodeResource(context.getResources(), R.drawable.school_logo, options);
        }
        return logo;
    }
}

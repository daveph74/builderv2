<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('template_items', function (Blueprint $table) {
            $table->decimal('lineHeight', 3, 1)->default(1.2)->after('textAlign');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('template_items', function (Blueprint $table) {
            $table->dropColumn('lineHeight');
        });
    }
};

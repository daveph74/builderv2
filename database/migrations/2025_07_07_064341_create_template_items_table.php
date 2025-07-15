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
        Schema::create('template_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('templates')->onDelete('cascade');
            $table->string('name');
            $table->string('type'); // text, heading, rectangle, circle, line, image
            $table->integer('x');
            $table->integer('y');
            $table->integer('width');
            $table->integer('height');
            $table->text('text')->nullable();
            $table->integer('fontSize')->default(14);
            $table->string('fontFamily')->default('Arial');
            $table->string('color')->default('#333333');
            $table->string('backgroundColor')->default('#3498db');
            $table->string('borderColor')->default('#2c3e50');
            $table->integer('borderWidth')->default(1);
            $table->decimal('opacity', 3, 2)->default(1.00);
            $table->integer('rotation')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('template_items');
    }
};
